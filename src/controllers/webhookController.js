const { enqueueWebhook } = require('../services/queueService');
const crypto = require('crypto');
const logger = require('../utils/logger');

const verifySignature = (req) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || secret === 'your_webhook_secret') {
    return true; 
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    logger.warn('Missing x-hub-signature-256 header');
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(req.rawBody || '').digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
};

const handleGitWebhook = async (req, res) => {
  try {
    if (!verifySignature(req)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid signature' });
    }

    const eventType = req.headers['x-github-event'] || req.headers['x-gitlab-event'] || 'unknown';
    
    if (eventType === 'push' || eventType === 'Push Hook') {
      let payload = req.body;
      
      logger.info('Incoming Webhook Push Event received');
      
      if (payload && typeof payload.payload === 'string') {
        try {
          payload = JSON.parse(payload.payload);
        } catch (e) {
          logger.error('Failed to parse form-urlencoded payload:', e);
          return res.status(400).json({ error: 'Bad Request: Invalid payload format' });
        }
      }

      if (!payload || !payload.commits || !Array.isArray(payload.commits)) {
        logger.warn('Request NOT added to queue: No commits array in payload');
        return res.status(200).json({ message: 'No commits to process' });
      }

      logger.info(`Request will be added to queue: Found ${payload.commits.length} commits in push event`);
      
      res.status(202).json({ message: 'Webhook received. Processing in background...' });

      enqueueWebhook(payload)
        .then(() => {
          logger.info('Webhook successfully enqueued for processing');
        })
        .catch(err => {
          logger.error(`Queue processing failed: ${err.message}`, { stack: err.stack });
        });
    } else {
      logger.info(`Request NOT added to queue: Event type '${eventType}' is not a push event`);
      res.status(200).json({ message: `Ignored event type: ${eventType}` });
    }
  } catch (error) {
    logger.error('Webhook controller error:', { stack: error.stack });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

module.exports = {
  handleGitWebhook
};
