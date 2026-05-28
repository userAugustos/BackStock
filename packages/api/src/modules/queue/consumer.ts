import { LOG_DOMAINS, logger } from '@core/logger';
import { withTraceContext } from '@core/telemetry';

import { getConnection } from './client';
import {
  RUN_REQUESTED_QUEUE_BINDING,
  RUN_REQUESTED_QUEUE_DECLARATION,
  RUNS_EXCHANGE_DECLARATION,
} from './topology';

const queueLogger = logger.child({ domain: LOG_DOMAINS.QUEUE });

export interface ConsumeArgs<T> {
  queue: string;
  handler: (payload: T) => Promise<void>;
}

export function consume<T>({ queue, handler }: ConsumeArgs<T>) {
  return getConnection().createConsumer(
    {
      queue,
      queueOptions: RUN_REQUESTED_QUEUE_DECLARATION,
      qos: { prefetchCount: 1 },
      exchanges: [RUNS_EXCHANGE_DECLARATION],
      queueBindings: [RUN_REQUESTED_QUEUE_BINDING],
    },
    async (msg) => {
      const traceId = (msg.headers?.['x-trace-id'] as string | undefined) ?? undefined;
      const parentSpanId = (msg.headers?.['x-span-id'] as string | undefined) ?? undefined;
      await withTraceContext({ trace_id: traceId, parent_span_id: parentSpanId }, async () => {
        try {
          await handler(msg.body as T);
        } catch (error) {
          queueLogger.error('Consumer error', { error, queue });
          throw error;
        }
      });
    }
  );
}
