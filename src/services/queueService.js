const { processPushPayload } = require('./webhookService');
const logger = require('../utils/logger');
const { Redis } = require('@upstash/redis');
require('dotenv').config();

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000];

let redis = null;

if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN
  });
  logger.info('Upstash Redis client initialized');
} else {
  logger.warn('UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not found in environment variables. Falling back to in-memory queue.');
}

const queue = [];
let activeWorkers = 0;
let isProcessing = false;

async function saveQueueToRedis() {
  if (!redis) return;
  
  try {
    const queueData = queue.map(item => ({
      payload: item.payload,
      retryCount: item.retryCount || 0
    }));
    await redis.set('webhook-queue', JSON.stringify(queueData));
    logger.debug('Queue saved to Redis');
  } catch (error) {
    logger.error('Failed to save queue to Redis:', error);
  }
}

async function loadQueueFromRedis() {
  if (!redis) return;
  
  try {
    const data = await redis.get('webhook-queue');
    if (data) {
      const queueData = JSON.parse(data);
      queueData.forEach(item => {
        queue.push({
          payload: item.payload,
          retryCount: item.retryCount || 0,
          resolve: () => {},
          reject: () => {}
        });
      });
      logger.info(`Loaded ${queueData.length} items from Redis queue`);
      await redis.del('webhook-queue');
      processQueue();
    } else {
      logger.info('No queue data found in Redis');
    }
  } catch (error) {
    logger.error('Failed to load queue from Redis:', error);
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
        await saveQueueToRedis();
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
    saveQueueToRedis();
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

loadQueueFromRedis();

module.exports = {
  enqueueWebhook,
  getQueueStats
};
