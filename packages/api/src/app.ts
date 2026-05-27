import { randomUUID } from 'crypto';

import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { Elysia } from 'elysia';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { db } from '@api/db/client';
import { config } from '@core/env';
import { errorPlugin } from '@core/errors';
import { LOG_DOMAINS, logger } from '@core/logger';
import { enterRequestContext } from '@core/request-context';
import { securityHeaders } from '@core/security-headers';
import { emitMetric } from '@core/telemetry';

const httpLogger = logger.child({ domain: LOG_DOMAINS.HTTP });

const getClientIp = (request: Request): string =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  request.headers.get('x-real-ip') ??
  'unknown';

export const createApp = () =>
  new Elysia({ name: 'store-pilot-api' })
    .use(errorPlugin)
    .use(securityHeaders())
    .onRequest(({ request, set }) => {
      const requestId =
        request.headers.get('x-request-id') ?? request.headers.get('cf-ray') ?? randomUUID();
      set.headers['x-request-id'] = requestId;
      (request as any).__requestId = requestId;
      (request as any).__startTime = performance.now();
      enterRequestContext(requestId, getClientIp(request));
    })
    .onAfterResponse(({ request, set, path: route }) => {
      const startTime = (request as any).__startTime;
      if (!startTime) return;
      const url = new URL(request.url);
      if (url.pathname === '/healthz') return;
      const duration_ms = Math.round((performance.now() - startTime) * 100) / 100;
      emitMetric('http.request.duration', duration_ms, {
        request_id: (request as any).__requestId,
        method: request.method,
        path: url.pathname,
        route,
        status: (set as any).status ?? 200,
      });
    })
    .use(cors())
    .use(
      config.isProduction
        ? new Elysia({ name: 'openapi-disabled' })
        : openapi({
            path: '/docs',
            mapJsonSchema: { zod: zodToJsonSchema },
            documentation: {
              info: { title: 'store-pilot API', version: '0.1.0' },
              tags: [],
            },
          })
    )
    .get(
      '/healthz',
      () => ({
        status: 'ok',
        version: process.env.GIT_COMMIT_SHA ?? 'unknown',
        timestamp: new Date().toISOString(),
      }),
      { detail: { summary: 'Health Check', tags: ['system'] } }
    );

export const storePilotApi = createApp();
// Feature modules attach here as: .use(<feature>Routes)

export type StorePilotApi = typeof storePilotApi;

export const setupApi = async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  httpLogger.info('Setup complete', { env: config.environment });
};

export const startApi = async ({ host, port }: { host: string; port: number }) => {
  httpLogger.info('Starting API', { env: config.environment });
  await setupApi();
  return storePilotApi.listen({ hostname: host, port }, ({ port }) => {
    httpLogger.info('API listening', { host, port, env: config.environment });
  });
};
