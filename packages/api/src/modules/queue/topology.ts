export const RUNS_EXCHANGE = 'runs';
export const RUN_REQUESTED_QUEUE = 'run.requested';
export const RUN_REQUESTED_ROUTING_KEY = 'run.requested';

export const RUNS_EXCHANGE_DECLARATION = {
  exchange: RUNS_EXCHANGE,
  type: 'direct',
  durable: true,
};

export const RUN_REQUESTED_QUEUE_DECLARATION = {
  queue: RUN_REQUESTED_QUEUE,
  durable: true,
};

export const RUN_REQUESTED_QUEUE_BINDING = {
  exchange: RUNS_EXCHANGE,
  queue: RUN_REQUESTED_QUEUE,
  routingKey: RUN_REQUESTED_ROUTING_KEY,
};
