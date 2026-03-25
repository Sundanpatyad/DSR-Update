const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function fetchCommitDetails(owner, repo, sha) {
  if (!GITHUB_TOKEN || GITHUB_TOKEN === 'your_github_personal_access_token') {
    logger.warn(`GITHUB_TOKEN is missing or using placeholder in .env. Cannot fetch additions/deletions/patch for commit ${sha}. Please provide a valid GitHub Personal Access Token.`);
    return [];
  }

  logger.info(`Fetching detailed stats for commit: ${owner}/${repo}@${sha}`);

  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Git-Commit-Tracker'
      }
    });

    if (response.data && response.data.files) {
      logger.info(`Successfully fetched details for ${response.data.files.length} files in commit ${sha}`);
      return response.data.files.map(file => ({
        filename: file.filename,
        additions: file.additions,
        deletions: file.deletions,
        status: file.status,
        patch: file.patch || ''
      }));
    }

    logger.warn(`No file data found in GitHub API response for commit ${sha}`);
    return [];
  } catch (error) {
    if (error.response && error.response.status === 401) {
      logger.error('GitHub API 401 Unauthorized: Your GITHUB_TOKEN is invalid or has expired.');
    } else if (error.response && error.response.status === 404) {
      logger.error(`GitHub API 404 Not Found: Could not find repository ${owner}/${repo} or commit ${sha}. Ensure the token has 'repo' scope.`);
    } else {
      logger.error(`Error fetching commit details for ${owner}/${repo}@${sha}:`, { message: error.message });
    }
    return [];
  }
}

module.exports = {
  fetchCommitDetails
};
