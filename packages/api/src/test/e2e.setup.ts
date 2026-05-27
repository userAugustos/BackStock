import { beforeAll } from 'bun:test';
import type { edenTreaty } from '@elysiajs/eden';

import { startApi } from '@api/app';
import type { BackStockApi } from '@api/app';
import { config } from '@core/env';

import { createApi } from './test.utils';

export let api: ReturnType<typeof edenTreaty<BackStockApi>>;

let setupPromise: Promise<void> | null = null;

async function startServers(): Promise<void> {
  const server = await startApi({ host: config.app.host, port: config.app.port });
  process.on('beforeExit', async () => {
    await server.stop();
  });
  api = createApi();
}

export function setupE2ETests() {
  beforeAll(() => {
    if (!setupPromise) setupPromise = startServers();
    return setupPromise;
  });
}
