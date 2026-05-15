#!/usr/bin/env node

const { execSync } = require("child_process");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

const crypto = require("crypto");

const SECRET =
  "5bskIQHmkkip7SEh924oYmdFjeSlLta41AVgtOBodC8a5Hfgj9xIcxoHv56LTdIIlZSKJWXyIZxs1EGRXvS4OBcMwyMl6UW8H5YL3BSIpv6My8OQm2ZVE1wmZas3pkSGQkoRdDYu5QWsDmBTcDhe7F32IAtLfp3kG6vwKLWkdoSVBXzOwgEfxFXzJ9Attj5KhTK0hoxc4lZpwExPIS3WcwDeJ0eiKm5XOxCuQdaJ1IeaCUYAdR10K5TaywfmWyjA";

function generateSignature(data) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex");
}

function getStagedFiles() {
  const output = execSync("git diff --cached --name-only", {
    encoding: "utf-8",
  }).trim();

  if (!output) return [];

  return output.split("\n");
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log("---------------------------------------------- \n-----------Custom Git Commit Tool------------\n----------------------------------------------");
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.error("Error: No files staged for commit. Use `git add` or a Git UI to stage files first.");
    process.exit(1);
  }
  const commitMsg = await askQuestion("1. Enter commit message (Required): ");
  if (!commitMsg.trim()) {
    console.error("Error: Commit message is compulsory.");
    process.exit(1);
  }

  const moduleName = await askQuestion("2. Enter Module Name (Required): ");
  if (!moduleName.trim()) {
    console.error("Error: Module Name is compulsory.");
    process.exit(1);
  }

  const taskType = await askQuestion(
    "3. Enter Task Type (Required): (F/f = Feature, B/b = Bug, R/r = Refactor)",
  );
  if (!taskType.trim()) {
    console.error("Error: Task Type is compulsory.");
    process.exit(1);
  }
  let tasktype = taskType.toLowerCase();
  tasktype =
    tasktype === "f"
      ? "feature"
      : tasktype === "b"
        ? "bug"
        : tasktype === "r"
          ? "refactor"
          : tasktype;
  if (!["feature", "bug", "refactor"].includes(tasktype)) {
    console.error("Error: Please enter valid input");
    process.exit(1);
  }

  let problemStmt = "N/A";
  if (["bug", "refactor"].includes(tasktype)) {
    problemStmt = await askQuestion(
      "3(i). Problem Statement (e.g., API null issue, UI padding issue, App crash on click etc.): (Required) ",
    );
    if (!problemStmt.trim()) {
      console.error(
        "Error: Problem Statement is compulsory if you select bug/refactor.",
      );
      process.exit(1);
    }
  }

  const ticketId = await askQuestion(
    "4. Enter Ticket ID (Optional – recommended for Bug/Refactor, press Enter to skip): ",
  );
  const dataToSign = `${commitMsg}|${moduleName}|${tasktype}|${problemStmt}|${ticketId}`;
  // console.log("Data to be signed: ", dataToSign);
  const signature = generateSignature(dataToSign);
  try {
    const finalTicket = ticketId.trim() || "N/A";
    
    // Create commit message in a temporary file to avoid shell escaping issues with many files
    const commitMessageLines = [
      commitMsg,
      "",
      `[Module: ${moduleName}]`,
      `[TaskType: ${tasktype}]`,
      `[Problem Statement: ${problemStmt}]`,
      `[TicketID: ${finalTicket}]`,
      `[Signature: ${signature}]`,
    ];
    const commitMessageContent = commitMessageLines.join("\n");
    
    const tempCommitFile = path.join(process.cwd(), ".git_commit_msg_temp");
    fs.writeFileSync(tempCommitFile, commitMessageContent, "utf-8");
    
    try {
      // Use -F flag to read commit message from file
      execSync(`git commit -F "${tempCommitFile}"`, { stdio: "inherit" });
      console.log("\nSuccessfully committed!");

      const pushAns = await askQuestion("6. Do you want to push now? (y/n): ");
      if (pushAns.toLowerCase() === "y" || pushAns.toLowerCase() === "yes") {
        execSync("git push", { stdio: "inherit" });
        console.log("Successfully pushed to remote!");
      } else {
        console.log("Skipped push.");
      }
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempCommitFile)) {
        fs.unlinkSync(tempCommitFile);
      }
    }
  } catch (error) {
    console.error("\nGit command failed.");
  } finally {
    rl.close();
  }
}

main();
