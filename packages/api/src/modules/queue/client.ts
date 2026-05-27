import { Connection } from 'rabbitmq-client';

import { config } from '@core/env';
import { LOG_DOMAINS, logger } from '@core/logger';

const queueLogger = logger.child({ domain: LOG_DOMAINS.QUEUE });

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (_connection) return _connection;
  _connection = new Connection(config.rabbitmq.url);
  _connection.on('error', (err) => queueLogger.error('RabbitMQ connection error', { error: err }));
  _connection.on('connection', () => queueLogger.info('RabbitMQ connected'));
  return _connection;
}
