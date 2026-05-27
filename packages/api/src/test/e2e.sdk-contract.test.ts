import { describe, expect, test } from 'bun:test';

import { api, setupE2ETests } from './e2e.setup';

setupE2ETests();

describe('SDK contract', () => {
  test('healthz round-trip via edenTreaty<StorePilotApi> preserves shape', async () => {
    const { data, error } = await api.healthz.get();
    expect(error).toBeNull();
    if (!data) throw new Error('healthz returned no data');
    data satisfies { status: string; version: string; timestamp: string };
    expect(data.status).toBe('ok');
  });
});
