import { initLogger, LOG_DOMAINS, logger } from '@core/logger';

initLogger();
const workerLogger = logger.child({ domain: LOG_DOMAINS.WORKER });

// Register consumers here as features need them.
workerLogger.info('Workers started');

process.on('SIGINT', () => {
  workerLogger.info('Workers shutting down');
  process.exit(0);
});
