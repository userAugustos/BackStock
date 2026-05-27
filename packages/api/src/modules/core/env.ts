import { helpers } from './env.helpers';

const env = Bun.env;
const { parseInteger, requireEnv } = helpers;
const environment = env.NODE_ENV ?? 'development';

export const config = {
  environment,
  isDevelopment: environment === 'development',
  isProduction: environment === 'production',
  isTest: environment === 'test',
  app: {
    port: parseInteger(env.PORT, 3000),
    host: env.HOST ?? '0.0.0.0',
    apiUrl: env.API_URL ?? 'http://localhost:3000',
  },
  web: {
    publicUrl: env.WEB_PUBLIC_URL ?? 'http://localhost:5173',
  },
  database: {
    url: env.DATABASE_URL ?? './data/back-stock.db',
  },
  rabbitmq: {
    url: requireEnv('RABBITMQ_URL'),
    prefix: env.RABBITMQ_PREFIX ?? '',
    managementUrl: env.RABBITMQ_MANAGEMENT_URL ?? '',
    managementPort: parseInteger(env.RABBITMQ_MANAGEMENT_PORT, 15672),
  },
};

export type Config = typeof config;
