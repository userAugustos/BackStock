import { consume } from '@api/modules/queue/consumer';
import { executeRun } from '@api/modules/runs/runs.worker';
import { initLogger, LOG_DOMAINS, logger } from '@core/logger';

initLogger();
const workerLogger = logger.child({ domain: LOG_DOMAINS.WORKER });

consume<{ run_id: string }>({
  queue: 'run.requested',
  handler: async (payload) => {
    workerLogger.info('Processing run', { run_id: payload.run_id });
    await executeRun(payload.run_id);
  },
});

workerLogger.info('Workers started');

process.on('SIGINT', () => {
  workerLogger.info('Workers shutting down');
  process.exit(0);
});
