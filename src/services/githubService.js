const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function fetchCommitDetails(owner, repo, sha) {
  if (!GITHUB_TOKEN || GITHUB_TOKEN === 'your_github_personal_access_token') {
    logger.warn(`GITHUB_TOKEN not provided or invalid. Skipping detailed fetch for commit ${sha}`);
    return [];
  }

  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (response.data && response.data.files) {
      return response.data.files.map(file => ({
        filename: file.filename,
        additions: file.additions,
        deletions: file.deletions,
        status: file.status,
        patch: file.patch || ''
      }));
    }

    return [];
  } catch (error) {
    logger.error(`Error fetching commit details for ${owner}/${repo}@${sha}:`, { message: error.message, stack: error.stack });
    return [];
  }
}

module.exports = {
  fetchCommitDetails
};
