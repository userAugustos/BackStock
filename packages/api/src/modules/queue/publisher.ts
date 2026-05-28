import { LOG_DOMAINS, logger } from '@core/logger';
import { getTraceContext } from '@core/telemetry';

import { getConnection } from './client';
import {
  RUN_REQUESTED_QUEUE_BINDING,
  RUN_REQUESTED_QUEUE_DECLARATION,
  RUNS_EXCHANGE_DECLARATION,
} from './topology';

const queueLogger = logger.child({ domain: LOG_DOMAINS.QUEUE });

export interface PublishArgs<T> {
  exchange: string;
  routingKey: string;
  payload: T;
}

export async function publish<T>({ exchange, routingKey, payload }: PublishArgs<T>): Promise<void> {
  const trace = getTraceContext();
  const pub = getConnection().createPublisher({
    confirm: true,
    queues: [RUN_REQUESTED_QUEUE_DECLARATION],
    exchanges: [RUNS_EXCHANGE_DECLARATION],
    queueBindings: [RUN_REQUESTED_QUEUE_BINDING],
  });
  const headers = trace ? { 'x-trace-id': trace.trace_id, 'x-span-id': trace.span_id } : {};
  try {
    await pub.send({ exchange, routingKey, headers, durable: true, mandatory: true }, payload);
    queueLogger.info('Published', { exchange, routingKey });
  } finally {
    await pub.close();
  }
}
