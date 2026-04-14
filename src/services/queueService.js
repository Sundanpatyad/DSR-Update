const { processPushPayload } = require('./webhookService');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '../../logs/queue-backup.json');
const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000];

const queue = [];
let activeWorkers = 0;
let isProcessing = false;

function saveQueueToDisk() {
  try {
    const queueData = queue.map(item => ({
      payload: item.payload,
      retryCount: item.retryCount || 0
    }));
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queueData, null, 2));
  } catch (error) {
    logger.error('Failed to save queue to disk:', error);
  }
}

function loadQueueFromDisk() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const data = fs.readFileSync(QUEUE_FILE, 'utf8');
      const queueData = JSON.parse(data);
      queueData.forEach(item => {
        queue.push({
          payload: item.payload,
          retryCount: item.retryCount || 0,
          resolve: () => {},
          reject: () => {}
        });
      });
      logger.info(`Loaded ${queueData.length} items from queue backup`);
      fs.unlinkSync(QUEUE_FILE);
      processQueue();
    }
  } catch (error) {
    logger.error('Failed to load queue from disk:', error);
  }
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0 || activeWorkers > 0) {
    while (queue.length > 0 && activeWorkers < MAX_CONCURRENCY) {
      const item = queue.shift();
      activeWorkers++;
      
      processItem(item).finally(() => {
        activeWorkers--;
        if (queue.length === 0 && activeWorkers === 0) {
          isProcessing = false;
        }
      });
    }

    if (queue.length > 0 || activeWorkers > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  isProcessing = false;
}

async function processItem(item) {
  const { payload, resolve, reject, retryCount = 0 } = item;
  
  try {
    logger.info(`Processing webhook. Queue: ${queue.length}, Active: ${activeWorkers}, Retry: ${retryCount}`);
    await processPushPayload(payload);
    resolve({ success: true });
    logger.info('Webhook processed successfully');
  } catch (error) {
    logger.error(`Webhook processing failed (attempt ${retryCount + 1}): ${error.message}`);
    
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      logger.info(`Retrying in ${delay}ms...`);
      
      setTimeout(async () => {
        item.retryCount = retryCount + 1;
        queue.unshift(item);
        saveQueueToDisk();
        processQueue();
      }, delay);
    } else {
      logger.error(`Webhook failed after ${MAX_RETRIES} retries. Giving up.`);
      reject(error);
    }
  }
}

async function enqueueWebhook(payload) {
  return new Promise((resolve, reject) => {
    queue.push({ payload, resolve, reject, retryCount: 0 });
    logger.info(`Webhook added to queue. Queue size: ${queue.length}, Active: ${activeWorkers}`);
    saveQueueToDisk();
    processQueue();
  });
}

function getQueueStats() {
  return {
    waiting: queue.length,
    running: activeWorkers,
    maxConcurrency: MAX_CONCURRENCY
  };
}

loadQueueFromDisk();

module.exports = {
  enqueueWebhook,
  getQueueStats
};
