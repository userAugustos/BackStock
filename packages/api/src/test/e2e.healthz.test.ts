import { describe, expect, test } from 'bun:test';

import { api, setupE2ETests } from './e2e.setup';

setupE2ETests();

describe('healthz', () => {
  test('returns ok', async () => {
    const { data, error } = await api.healthz.get();
    expect(error).toBeNull();
    expect(data?.status).toBe('ok');
    expect(typeof data?.timestamp).toBe('string');
  });
});
