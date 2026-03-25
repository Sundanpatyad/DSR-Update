const express = require('express');
const { handleGitWebhook } = require('../controllers/webhookController');

const router = express.Router();

router.post('/git', handleGitWebhook);

module.exports = router;
