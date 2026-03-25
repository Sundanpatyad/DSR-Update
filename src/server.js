require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { error });
  process.exit(1);
});

const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  logger.info(`Listening for Webhooks at: http://localhost:${PORT}/webhook/git`);
});

server.on('error', (err) => {
  logger.error(`Server failed to start: ${err.message}`);
  process.exit(1);
});
