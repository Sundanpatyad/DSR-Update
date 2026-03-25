const { appendCommitData } = require('../utils/excelUtil');
const { appendToGoogleSheet } = require('../utils/googleSheetsUtil');
const { fetchCommitDetails } = require('./githubService');
const logger = require('../utils/logger');

async function processPushPayload(payload) {
  logger.info('--- Inside processPushPayload ---');
  if (process.env.NODE_ENV !== 'production') {
    logger.debug('Payload passed to service:', JSON.stringify(payload, null, 2));
  }

  try {
    if (!payload) {
      logger.warn('Payload is empty or undefined. Skipping.');
      return;
    }

    const commits = payload.commits || [];
    logger.info(`Found ${commits.length} commits in payload.`);
    
    if (commits.length === 0) {
      logger.warn('No commits found in payload. Skipping.');
      return;
    }

    let branch = 'unknown';
    if (payload.ref) {
      const refParts = payload.ref.split('/');
      branch = refParts[refParts.length - 1];
    }

    let owner = '';
    let repoName = '';
    if (payload.repository) {
      repoName = payload.repository.name || '';
      owner = payload.repository.owner?.login || payload.repository.owner?.name || '';
    }

    const excelRows = [];

    for (const commit of commits) {
      const sha = commit.id;
      const author = commit.author?.name || 'Unknown Author';
      const email = commit.author?.email || 'unknown_email';
      const rawMessage = commit.message || '';
      const date = commit.timestamp || new Date().toISOString();

      let moduleName = 'N/A';
      let taskType = 'N/A';
      let problemStatement = 'N/A';
      let ticketId = 'N/A';
      let message = rawMessage;
      
      const moduleMatch = rawMessage.match(/\[Module: (.*?)\]/i);
      const typeMatch = rawMessage.match(/\[TaskType: (.*?)\]/i);
      const problemMatch = rawMessage.match(/\[Problem Statement: (.*?)\]/i);
      const ticketMatch = rawMessage.match(/\[TicketID: (.*?)\]/i);

      if (moduleMatch) moduleName = moduleMatch[1].trim();
      if (typeMatch) taskType = typeMatch[1].trim();
      if (problemMatch) problemStatement = problemMatch[1].trim();
      if (ticketMatch) ticketId = ticketMatch[1].trim();

      message = rawMessage
        .replace(/\[Module: .*?\]/gi, '')
        .replace(/\[TaskType: .*?\]/gi, '')
        .replace(/\[Problem Statement: .*?\]/gi, '')
        .replace(/\[TicketID: .*?\]/gi, '')
        .trim();

      let detailedStats = [];
      if (owner && repoName && process.env.GITHUB_TOKEN) {
        detailedStats = await fetchCommitDetails(owner, repoName, sha);
      }

      const processFiles = (files, changeType) => {
        if (!files || !Array.isArray(files)) return;

        for (const filename of files) {
          const fileStats = detailedStats.find(s => s.filename === filename);
          const patchData = fileStats ? fileStats.patch : '';
          
          if (fileStats) {
            if (process.env.NODE_ENV !== 'production') {
              logger.info(`\n=== Changes for ${filename} (${changeType}) by ${email} ===`);
              logger.info(`Additions: ${fileStats.additions} | Deletions: ${fileStats.deletions}`);
              if (patchData) {
                logger.info('Patch:');
                logger.info(patchData);
              }
              logger.info(`====================================================\n`);
            }
          }

          excelRows.push({
            repo: repoName || 'Unknown Repo',
            date,
            author,
            email,
            branch,
            sha,
            message,
            moduleName,
            taskType,
            problemStatement,
            ticketId,
            filename,
            changeType,
            additions: fileStats ? fileStats.additions : undefined,
            deletions: fileStats ? fileStats.deletions : undefined,
            patch: patchData
          });
        }
      };

      processFiles(commit.added, 'Added');
      processFiles(commit.modified, 'Modified');
      processFiles(commit.removed, 'Removed');
    }

    if (excelRows.length > 0) {
      logger.info(`Processing ${excelRows.length} file changes for repo ${repoName}...`);

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
        
        const combinedFileNames = fileRows.map(r => `[${r.changeType}] ${r.filename}`).join('\n');
        
        const combinedPatches = fileRows.map(r => {
          if (!r.patch) return `--- No patch data for ${r.filename} ---`;
          return `File: ${r.filename}\n------------------\n${r.patch}\n`;
        }).join('\n\n====================\n\n');

        const totalAdditions = fileRows.reduce((sum, r) => sum + (r.additions || 0), 0);
        const totalDeletions = fileRows.reduce((sum, r) => sum + (r.deletions || 0), 0);

        combinedRows.push({
          repo: firstRow.repo,
          date: firstRow.date,
          author: firstRow.author,
          email: firstRow.email,
          branch: firstRow.branch,
          sha: firstRow.sha,
          message: firstRow.message,
          moduleName: firstRow.moduleName,
          taskType: firstRow.taskType,
          problemStatement: firstRow.problemStatement,
          ticketId: firstRow.ticketId,
          filename: combinedFileNames,
          changeType: fileRows.length > 1 ? 'Multiple' : firstRow.changeType,
          additions: totalAdditions,
          deletions: totalDeletions,
          patch: combinedPatches
        });
      }
      
      // Sync to Google Sheets only
      await appendToGoogleSheet(combinedRows);
      
    } else {
      logger.info('No file changes detected in the commits.');
    }

  } catch (error) {
    logger.error('Error processing push payload:', error);
    throw error;
  }
}

module.exports = {
  processPushPayload
};
