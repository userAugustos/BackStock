import { describe, expect, test } from 'bun:test';

import { config } from '@core/env';

import { setupE2ETests } from './e2e.setup';

setupE2ETests();

const BASE = () => `${config.app.apiUrl}/versions`;

async function postVersion(overrides: Record<string, unknown> = {}) {
  return fetch(BASE(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      label: `v-${crypto.randomUUID()}`,
      inventory_prompt_version: 'inv-v1',
      pricing_prompt_version: 'price-v1',
      model_id: 'claude-3-haiku',
      ...overrides,
    }),
  });
}

describe('versions', () => {
  test('CRUD + validation + error paths', async () => {
    // 1. POST happy path: create with all fields
    const label = `test-version-${crypto.randomUUID()}`;
    const r1 = await postVersion({ label, policy: { max_order: 100 } });
    expect(r1.status).toBe(201);
    const created = (await r1.json()) as any;
    expect(created.data.label).toBe(label);
    expect(created.data.inventory_prompt_version).toBe('inv-v1');
    expect(created.data.pricing_prompt_version).toBe('price-v1');
    expect(created.data.model_id).toBe('claude-3-haiku');
    expect(created.data.policy).toEqual({ max_order: 100 });
    expect(created.data.id).toBeTruthy();
    expect(created.data.created_at).toBeTruthy();

    // 2. POST duplicate label -> 409
    const dupLabel = `dup-${crypto.randomUUID()}`;
    const r2a = await postVersion({ label: dupLabel });
    expect(r2a.status).toBe(201);
    await r2a.json();

    const r2b = await postVersion({ label: dupLabel });
    expect(r2b.status).toBe(409);
    const dupBody = (await r2b.json()) as any;
    expect(dupBody.error).toBe('version_label_exists');

    // 3. POST missing model_id -> 422
    const r3 = await fetch(BASE(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: `no-model-${crypto.randomUUID()}`,
        inventory_prompt_version: 'inv-v1',
        pricing_prompt_version: 'price-v1',
      }),
    });
    expect(r3.status).toBe(422);
    await r3.json();

    // 4. POST policy omitted -> 201, policy: null
    const r4 = await postVersion();
    expect(r4.status).toBe(201);
    const noPolicy = (await r4.json()) as any;
    expect(noPolicy.data.policy).toBeNull();

    // 5. GET /versions -> lists all, ordered by created_at desc
    const r5list = await fetch(BASE());
    expect(r5list.status).toBe(200);
    const listBody = (await r5list.json()) as any;
    expect(listBody.data.length).toBeGreaterThanOrEqual(3);
    const labels: string[] = listBody.data.map((v: any) => v.label);
    expect(labels).toContain(label);
    expect(labels).toContain(dupLabel);
    const timestamps: string[] = listBody.data.map((v: any) => v.created_at);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]! <= timestamps[i - 1]!).toBe(true);
    }

    // 6. GET /versions/:id -> returns detail
    const detailLabel = `detail-${crypto.randomUUID()}`;
    const r6create = await postVersion({ label: detailLabel, policy: { threshold: 50 } });
    expect(r6create.status).toBe(201);
    const r6created = (await r6create.json()) as any;
    const versionId = r6created.data.id;

    const r6get = await fetch(`${BASE()}/${versionId}`);
    expect(r6get.status).toBe(200);
    const detail = (await r6get.json()) as any;
    expect(detail.data.id).toBe(versionId);
    expect(detail.data.label).toBe(detailLabel);
    expect(detail.data.policy).toEqual({ threshold: 50 });

    // 7. GET /versions/:id -> non-existent -> 404
    const r7 = await fetch(`${BASE()}/nonexistent-id`);
    expect(r7.status).toBe(404);
    const r7body = (await r7.json()) as any;
    expect(r7body.error).toBe('version_not_found');
  });
});
