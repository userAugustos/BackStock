import { LOG_DOMAINS, logger } from '@core/logger';
import { withTraceContext } from '@core/telemetry';

import { getConnection } from './client';

const queueLogger = logger.child({ domain: LOG_DOMAINS.QUEUE });

export interface ConsumeArgs<T> {
  queue: string;
  handler: (payload: T) => Promise<void>;
}

export function consume<T>({ queue, handler }: ConsumeArgs<T>) {
  return getConnection().createConsumer({ queue, qos: { prefetchCount: 1 } }, async (msg) => {
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
  });
}
