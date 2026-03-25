const { appendCommitData } = require('../utils/excelUtil');
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

      let problemStatement = 'N/A';
      let message = rawMessage;
      
      const problemMatch = rawMessage.match(/\[Problem Statement: (.*?)\]/i);
      if (problemMatch && problemMatch[1]) {
        problemStatement = problemMatch[1].trim();
        message = rawMessage.replace(/\[Problem Statement: .*?\]/gi, '').trim();
      }

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
            problemStatement,
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
      logger.info(`Sending ${excelRows.length} total rows for repo ${repoName} to Excel writer...`);
      await appendCommitData(excelRows);
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
