const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const webhookRoutes = require('./routes/webhookRoutes');
const logger = require('./utils/logger');

const app = express();

app.use(helmet());

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

app.use('/webhook', webhookRoutes);
//test commit
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
