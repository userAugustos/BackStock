import { helpers } from './env.helpers';

const env = Bun.env;
const { parseInteger } = helpers;
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
    url: env.DATABASE_URL ?? './data/store-pilot.db',
  },
};

export type Config = typeof config;
