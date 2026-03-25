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

    const developerRows = {};

    for (const commit of commits) {
      const sha = commit.id;
      const author = commit.author?.name || 'Unknown Author';
      const email = commit.author?.email || 'unknown_email';
      const message = commit.message || '';
      const date = commit.timestamp || new Date().toISOString();

      if (!developerRows[email]) {
        developerRows[email] = [];
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
          
          if (patchData) {
            if (process.env.NODE_ENV !== 'production') {
              logger.info(`\n=== Code Changes for ${filename} (${changeType}) by ${email} ===`);
              logger.info(patchData);
              logger.info(`====================================================\n`);
            }
          }

          developerRows[email].push({
            repo: repoName || 'Unknown Repo',
            date,
            author,
            email,
            branch,
            sha,
            message,
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

    const developerEmails = Object.keys(developerRows);
    if (developerEmails.length > 0) {
      for (const email of developerEmails) {
        const rows = developerRows[email];
        if (rows.length > 0) {
          logger.info(`Sending ${rows.length} rows for developer ${email} to Excel writer...`);
          await appendCommitData(rows);
        }
      }
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
