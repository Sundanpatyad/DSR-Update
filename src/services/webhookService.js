const { appendCommitData } = require("../utils/excelUtil");
const { appendToGoogleSheet } = require("../utils/googleSheetsUtil");
const { fetchCommitDetails } = require("./githubService");
const { verifycodeSignature } = require("../utils/verifysignature");
const { sendUnauthorizedEmail } = require("../integration/emailservice");
const logger = require("../utils/logger");

async function processPushPayload(payload) {
  logger.info("--- Inside processPushPayload ---");
  if (process.env.NODE_ENV !== "production") {
    logger.debug(
      "Payload passed to service:",
      JSON.stringify(payload, null, 2),
    );
  }

  try {
    if (!payload) {
      logger.warn("Payload is empty or undefined. Skipping.");
      return;
    }

    const commits = payload.commits || [];
    logger.info(`Found ${commits.length} commits in payload.`);

    if (commits.length === 0) {
      logger.warn("No commits found in payload. Skipping.");
      return;
    }

    let branch = "unknown";
    if (payload.ref) {
      const refParts = payload.ref.split("/");
      branch = refParts[refParts.length - 1];
    }

    let owner = "";
    let repoName = "";
    if (payload.repository) {
      repoName = payload.repository.name || "";
      owner =
        payload.repository.owner?.login || payload.repository.owner?.name || "";
    }

    const excelRows = [];
    console.log("payload.repository", payload);
    for (const commit of commits) {
      console.log("=========>>>> commit", commit);
      const sha = commit.id;
      const author = commit.author?.name || "Unknown Author";
      const email = commit.author?.email || "unknown_email";
      const rawMessage = commit.message || "";
      const date = commit.timestamp || new Date().toISOString();
      const commitUrl =
        commit.url || `https://github.com/${owner}/${repoName}/commit/${sha}`;

      let moduleName = "N/A";
      let taskType = "N/A";
      let problemStatement = "N/A";
      let ticketId = "N/A";
      let message = rawMessage;
      let signature = "Unauthorized commit";

      // Parse structured fields written by git-commit.js:
      //   [Module: ...] [TaskType: ...] [Problem: ...] [Ticket: ...]
      const moduleMatch = rawMessage.match(/\[Module:\s*(.*?)\]/i);
      const typeMatch = rawMessage.match(/\[TaskType:\s*(.*?)\]/i);
      const problemMatch = rawMessage.match(/\[Problem Statement:\s*(.*?)\]/i);
      const ticketMatch = rawMessage.match(/\[TicketID:\s*(.*?)\]/i);
      const signatureMatch = rawMessage.match(/\[Signature:\s*(.*?)\]/i);

      console.log("signatureMatch ", signatureMatch);

      if (signatureMatch) signature = signatureMatch[1].trim();

      if (moduleMatch) moduleName = moduleMatch[1].trim();
      if (typeMatch) taskType = typeMatch[1].trim();
      if (problemMatch) problemStatement = problemMatch[1].trim();
      if (ticketMatch) ticketId = ticketMatch[1].trim();

      // console.log("RAW MESSAGE --->>>: ", rawMessage);
      // const lines = rawMessage
      //   .split("\n")
      //   .map((l) => l.trim())
      //   .filter((l) => l && !l.startsWith("["));

      const finalTicket = ticketId === "N/A" ? "" : (ticketId || "").trim();

      // const baseMessage = rawMessage.split("\n")[0].trim();
      const baseMessage = rawMessage
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith("[") && l !== "Menu");

      // console.log("---------------->>> baseMessage: ", baseMessage);

      console.log("aall fields extracted: ", {
        baseMessage,
        moduleName,
        taskType,
        problemStatement,
        finalTicket,
      });

      // console.log("signature before verification: ", signature);

      const clean = (v) => (v || "").replace(/\r/g, "").trim();

      const dataToVerify = [
        clean(baseMessage),
        clean(moduleName),
        clean(taskType),
        clean(problemStatement),
        clean(finalTicket),
      ].join("|");

      console.log("VERIFY STRING:", JSON.stringify(dataToVerify));
      signature = verifycodeSignature(dataToVerify, signature);

      if (signature === "Unauthorized") {
        await sendUnauthorizedEmail(email, rawMessage).catch((err) => {
          logger.error(
            `Failed to send unauthorized email to ${email} for commit ${sha}:`,
            err,
          );
        });
      }

      message = rawMessage
        .replace(/\[Module:\s*.*?\]/gi, "")
        .replace(/\[TaskType:\s*.*?\]/gi, "")
        .replace(/\[Problem Statement:\s*.*?\]/gi, "")
        .replace(/\[TicketID:\s*.*?\]/gi, "")
        .replace(/\n+/g, " ")
        .trim();

      let detailedStats = [];
      if (owner && repoName && process.env.GITHUB_TOKEN) {
        detailedStats = await fetchCommitDetails(owner, repoName, sha);
      }

      const processFiles = (files, changeType) => {
        if (!files || !Array.isArray(files)) return;

        for (const filename of files) {
          const fileStats = detailedStats.find((s) => s.filename === filename);

          if (fileStats) {
            if (process.env.NODE_ENV !== "production") {
              logger.info(
                `\n=== Changes for ${filename} (${changeType}) by ${email} ===`,
              );
              logger.info(
                `Additions: ${fileStats.additions} | Deletions: ${fileStats.deletions}`,
              );
              logger.info(
                `====================================================\n`,
              );
            }
          }

          excelRows.push({
            repo: repoName || "Unknown Repo",
            date,
            author,
            email,
            branch,
            sha,
            commitUrl,
            message,
            moduleName,
            taskType,
            problemStatement,
            ticketId,
            filename,
            changeType,
            additions: fileStats ? fileStats.additions : undefined,
            deletions: fileStats ? fileStats.deletions : undefined,
            signature,
          });
        }
      };

      processFiles(commit.added, "Added");
      processFiles(commit.modified, "Modified");
      processFiles(commit.removed, "Removed");
    }

    if (excelRows.length > 0) {
      logger.info(
        `Processing ${excelRows.length} file changes for repo ${repoName}...`,
      );

      // Combine multiple file changes into a single row per commit
      const commitsMap = new Map();
      for (const row of excelRows) {
        if (!commitsMap.has(row.sha)) {
          commitsMap.set(row.sha, []);
        }
        commitsMap.get(row.sha).push(row);
      }

      const combinedRows = [];

      for (const [sha, fileRows] of commitsMap.entries()) {
        const firstRow = fileRows[0];

        const combinedFileNames = fileRows
          .map((r) => `[${r.changeType}] ${r.filename}`)
          .join("\n");

        const totalAdditions = fileRows.reduce(
          (sum, r) => sum + (r.additions || 0),
          0,
        );
        const totalDeletions = fileRows.reduce(
          (sum, r) => sum + (r.deletions || 0),
          0,
        );

        combinedRows.push({
          repo: firstRow.repo,
          date: firstRow.date,
          author: firstRow.author,
          email: firstRow.email,
          branch: firstRow.branch,
          sha: firstRow.sha,
          commitUrl: firstRow.commitUrl,
          message: firstRow.message,
          moduleName: firstRow.moduleName,
          taskType: firstRow.taskType,
          problemStatement: firstRow.problemStatement,
          ticketId: firstRow.ticketId,
          filename: combinedFileNames,
          changeType: fileRows.length > 1 ? "Multiple" : firstRow.changeType,
          additions: totalAdditions,
          deletions: totalDeletions,
          signature: firstRow.signature,
        });
      }

      logger.info(
        `Combined ${excelRows.length} file changes into ${combinedRows.length} commit rows`,
      );

      // Sync to Google Sheets only
      logger.info(
        `Calling appendToGoogleSheet with ${combinedRows.length} combined rows`,
      );
      await appendToGoogleSheet(combinedRows);
      logger.info(`Successfully completed appendToGoogleSheet`);
    } else {
      logger.info("No file changes detected in the commits.");
    }
  } catch (error) {
    logger.error("Error processing push payload:", error);
    throw error;
  }
}

module.exports = {
  processPushPayload,
};
