const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const commitCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    logger.debug(`Rate limiting: waiting ${delay}ms before GitHub API call`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  lastRequestTime = Date.now();
}

async function fetchCommitDetails(owner, repo, sha) {
  const cacheKey = `${owner}/${repo}/${sha}`;
  
  const cached = commitCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug(`Cache hit for commit ${sha}`);
    return cached.data;
  }

  if (!GITHUB_TOKEN || GITHUB_TOKEN === 'your_github_personal_access_token') {
    logger.warn(`GITHUB_TOKEN is missing or using placeholder in .env. Cannot fetch additions/deletions/patch for commit ${sha}. Please provide a valid GitHub Personal Access Token.`);
    return [];
  }

  await waitForRateLimit();

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
      const fileData = response.data.files.map(file => ({
        filename: file.filename,
        additions: file.additions,
        deletions: file.deletions,
        status: file.status,
        patch: file.patch || ''
      }));
      
      commitCache.set(cacheKey, {
        data: fileData,
        timestamp: Date.now()
      });
      
      logger.info(`Successfully fetched details for ${response.data.files.length} files in commit ${sha}`);
      return fileData;
    }

    logger.warn(`No file data found in GitHub API response for commit ${sha}`);
    return [];
  } catch (error) {
    if (error.response && error.response.status === 401) {
      logger.error('GitHub API 401 Unauthorized: Your GITHUB_TOKEN is invalid or has expired.');
    } else if (error.response && error.response.status === 403) {
      logger.error('GitHub API 403 Forbidden: Rate limit exceeded. Please wait or increase MIN_REQUEST_INTERVAL.');
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
