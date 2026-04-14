const { processPushPayload } = require('./webhookService');
const logger = require('../utils/logger');

const queue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  
  isProcessing = true;
  
  while (queue.length > 0) {
    const { payload, resolve, reject } = queue.shift();
    logger.info(`Processing webhook from queue. Remaining: ${queue.length}`);
    
    try {
      await processPushPayload(payload);
      resolve({ success: true });
    } catch (error) {
      logger.error(`Queue processing failed: ${error.message}`);
      reject(error);
    }
  }
  
  isProcessing = false;
}

async function enqueueWebhook(payload) {
  return new Promise((resolve, reject) => {
    queue.push({ payload, resolve, reject });
    logger.info(`Webhook added to queue. Queue size: ${queue.length}`);
    processQueue();
  });
}

function getQueueStats() {
  return {
    waiting: queue.length,
    running: isProcessing ? 1 : 0
  };
}

module.exports = {
  enqueueWebhook,
  getQueueStats
};
