import { describe, expect, test } from 'bun:test';

import { config } from '@core/env';

import { setupE2ETests } from './e2e.setup';

setupE2ETests();

const BASE = () => `${config.app.apiUrl}/days`;

const VALID_SEED_STATE = {
  skus: [
    {
      id: 'milk-2pct-gal',
      on_hand: 30,
      price: 3.99,
      unit_cost: 2.8,
      shelf_life_hours: 96,
      case_size: 6,
    },
    {
      id: 'produce-lettuce',
      on_hand: 24,
      price: 1.99,
      unit_cost: 1.1,
      shelf_life_hours: 48,
      case_size: 12,
    },
  ],
  vendors: [{ id: 'dairy-co', lead_time_hours: 18, next_delivery_at: '2026-03-18T10:00:00' }],
};

async function postDay(overrides: Record<string, unknown> = {}) {
  return fetch(BASE(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: `day-${crypto.randomUUID()}`,
      seed_state: VALID_SEED_STATE,
      events: [
        {
          seq: 0,
          at: '08:00',
          type: 'sales_spike',
          payload: { sku: 'milk-2pct-gal', multiplier: 2.0 },
        },
        {
          seq: 1,
          at: '09:00',
          type: 'vendor_delay',
          payload: { vendor: 'dairy-co', delay_hours: 4 },
        },
      ],
      ...overrides,
    }),
  });
}

describe('days', () => {
  test('POST + GET + normalizer + validation + error paths', async () => {
    // 1. POST happy path: all events accepted
    const happyName = `test-day-${crypto.randomUUID()}`;
    const r1 = await postDay({ name: happyName });
    expect(r1.status).toBe(201);
    const d1 = (await r1.json()) as any;
    expect(d1.data.name).toBe(happyName);
    expect(d1.data.source).toBe('upload');
    expect(d1.data.event_count).toBe(2);
    expect(d1.data.sku_count).toBe(2);
    expect(d1.data.ignored_report).toBeNull();
    expect(d1.data.id).toBeTruthy();

    // 2. POST some events ignored (unknown SKU)
    const r2 = await postDay({
      name: `ignored-sku-${crypto.randomUUID()}`,
      events: [
        {
          seq: 0,
          at: '08:00',
          type: 'sales_spike',
          payload: { sku: 'milk-2pct-gal', multiplier: 2.0 },
        },
        {
          seq: 1,
          at: '09:00',
          type: 'damage_report',
          payload: { sku: 'nonexistent-sku', units: 5 },
        },
      ],
    });
    expect(r2.status).toBe(201);
    const d2 = (await r2.json()) as any;
    expect(d2.data.event_count).toBe(1);
    expect(d2.data.ignored_report).toHaveLength(1);
    expect(d2.data.ignored_report[0].reason).toBe('unknown_sku');

    // 3. POST some events ignored (unknown event type)
    const r3 = await postDay({
      name: `ignored-type-${crypto.randomUUID()}`,
      events: [
        {
          seq: 0,
          at: '08:00',
          type: 'sales_spike',
          payload: { sku: 'milk-2pct-gal', multiplier: 2.0 },
        },
        { seq: 1, at: '09:00', type: 'alien_invasion', payload: { severity: 'high' } },
      ],
    });
    expect(r3.status).toBe(201);
    const d3 = (await r3.json()) as any;
    expect(d3.data.event_count).toBe(1);
    expect(d3.data.ignored_report).toHaveLength(1);
    expect(d3.data.ignored_report[0].reason).toBe('unknown_event_type');

    // 3b. POST some events ignored (unknown vendor)
    const r3b = await postDay({
      name: `ignored-vendor-${crypto.randomUUID()}`,
      events: [
        {
          seq: 0,
          at: '08:00',
          type: 'sales_spike',
          payload: { sku: 'milk-2pct-gal', multiplier: 2.0 },
        },
        {
          seq: 1,
          at: '09:00',
          type: 'vendor_delay',
          payload: { vendor: 'nonexistent-vendor', delay_hours: 4 },
        },
      ],
    });
    expect(r3b.status).toBe(201);
    const d3b = (await r3b.json()) as any;
    expect(d3b.data.event_count).toBe(1);
    expect(d3b.data.ignored_report).toHaveLength(1);
    expect(d3b.data.ignored_report[0].reason).toBe('unknown_vendor');

    const r3c = await postDay({
      name: `invalid-payload-${crypto.randomUUID()}`,
      events: [
        {
          seq: 0,
          at: '08:00',
          type: 'sales_spike',
          payload: { sku: 'milk-2pct-gal', multiplier: 2.0 },
        },
        {
          seq: 1,
          at: '09:00',
          type: 'sales_spike',
          payload: { multiplier: 2.0 },
        },
        {
          seq: 2,
          at: '10:00',
          type: 'damage_report',
          payload: { sku: 'produce-lettuce', units: 'five' },
        },
      ],
    });
    expect(r3c.status).toBe(201);
    const d3c = (await r3c.json()) as any;
    expect(d3c.data.event_count).toBe(1);
    expect(d3c.data.ignored_report).toHaveLength(2);
    expect(d3c.data.ignored_report.map((item: any) => item.reason)).toEqual([
      'invalid_payload',
      'invalid_payload',
    ]);

    // 4. POST all events ignored -> 400
    const r4 = await postDay({
      name: `all-ignored-${crypto.randomUUID()}`,
      events: [
        { seq: 0, at: '08:00', type: 'alien_invasion', payload: { severity: 'high' } },
        { seq: 1, at: '09:00', type: 'time_travel', payload: { year: 2099 } },
      ],
    });
    expect(r4.status).toBe(400);
    const d4 = (await r4.json()) as any;
    expect(d4.error).toBe('all_events_ignored');

    const r4b = await postDay({
      name: `all-invalid-known-${crypto.randomUUID()}`,
      events: [
        { seq: 0, at: '08:00', type: 'sales_spike', payload: { multiplier: 2.0 } },
        { seq: 1, at: '09:00', type: 'vendor_delay', payload: { delay_hours: 4 } },
      ],
    });
    expect(r4b.status).toBe(400);
    const d4b = (await r4b.json()) as any;
    expect(d4b.error).toBe('all_events_ignored');

    // 5. POST duplicate seq -> 400
    const r5 = await postDay({
      name: `dup-seq-${crypto.randomUUID()}`,
      events: [
        {
          seq: 0,
          at: '08:00',
          type: 'sales_spike',
          payload: { sku: 'milk-2pct-gal', multiplier: 2.0 },
        },
        {
          seq: 0,
          at: '09:00',
          type: 'vendor_delay',
          payload: { vendor: 'dairy-co', delay_hours: 4 },
        },
      ],
    });
    expect(r5.status).toBe(400);
    const d5 = (await r5.json()) as any;
    expect(d5.error).toBe('duplicate_event_seq');

    // 6. POST missing name -> 422
    const r6 = await fetch(BASE(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        seed_state: VALID_SEED_STATE,
        events: [
          {
            seq: 0,
            at: '08:00',
            type: 'sales_spike',
            payload: { sku: 'milk-2pct-gal', multiplier: 2.0 },
          },
        ],
      }),
    });
    expect(r6.status).toBe(422);
    await r6.json();

    // 7. POST empty events -> 422
    const r7 = await fetch(BASE(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `empty-events-${crypto.randomUUID()}`,
        seed_state: VALID_SEED_STATE,
        events: [],
      }),
    });
    expect(r7.status).toBe(422);
    await r7.json();

    // 8. POST empty skus -> 422
    const r8 = await fetch(BASE(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `empty-skus-${crypto.randomUUID()}`,
        seed_state: { skus: [], vendors: VALID_SEED_STATE.vendors },
        events: [
          {
            seq: 0,
            at: '08:00',
            type: 'sales_spike',
            payload: { sku: 'milk-2pct-gal', multiplier: 2.0 },
          },
        ],
      }),
    });
    expect(r8.status).toBe(422);
    await r8.json();

    // 9. GET /days -> lists all including seeded hero day
    const r9 = await fetch(BASE());
    expect(r9.status).toBe(200);
    const listAll = (await r9.json()) as any;
    const names: string[] = listAll.data.map((d: any) => d.name);
    expect(names).toContain('Tue Mar 18 — milk crisis');

    // 10. GET /days -> uploaded days appear after creation
    expect(names).toContain(happyName);

    // 11. GET /days -> returns sku_count and event_count
    const heroInList = listAll.data.find((d: any) => d.name === 'Tue Mar 18 — milk crisis');
    expect(heroInList).toBeTruthy();
    expect(heroInList.sku_count).toBe(2);
    expect(heroInList.event_count).toBe(6);

    // 12. GET /days/:id -> returns detail with seed_state
    const heroId = heroInList.id;
    const r12 = await fetch(`${BASE()}/${heroId}`);
    expect(r12.status).toBe(200);
    const heroDetail = (await r12.json()) as any;
    expect(heroDetail.data.seed_state).toBeTruthy();
    expect(heroDetail.data.seed_state.skus).toHaveLength(2);
    expect(heroDetail.data.seed_state.vendors).toHaveLength(1);
    expect(heroDetail.data.sku_count).toBe(2);

    // 13. GET /days/:id -> non-existent -> 404
    const r13 = await fetch(`${BASE()}/nonexistent-id`);
    expect(r13.status).toBe(404);
    const r13body = (await r13.json()) as any;
    expect(r13body.error).toBe('day_not_found');

    // 14. GET /days/:id/events -> returns events in seq order (hero day: 6 events)
    const r14 = await fetch(`${BASE()}/${heroId}/events`);
    expect(r14.status).toBe(200);
    const heroEvents = (await r14.json()) as any;
    expect(heroEvents.data).toHaveLength(6);
    const seqs14: number[] = heroEvents.data.map((e: any) => e.seq);
    expect(seqs14).toEqual([0, 1, 2, 3, 4, 5]);

    // 15. GET /days/:id/events -> non-existent day -> 404
    const r15 = await fetch(`${BASE()}/nonexistent-id/events`);
    expect(r15.status).toBe(404);
    const r15body = (await r15.json()) as any;
    expect(r15body.error).toBe('day_not_found');

    // 16. Accepted events have contiguous seq after normalization
    const r16create = await postDay({
      name: `renumber-${crypto.randomUUID()}`,
      events: [
        {
          seq: 0,
          at: '08:00',
          type: 'sales_spike',
          payload: { sku: 'milk-2pct-gal', multiplier: 2.0 },
        },
        { seq: 1, at: '09:00', type: 'alien_invasion', payload: { severity: 'high' } },
        {
          seq: 2,
          at: '10:00',
          type: 'vendor_delay',
          payload: { vendor: 'dairy-co', delay_hours: 4 },
        },
        { seq: 3, at: '11:00', type: 'unknown_type', payload: {} },
        {
          seq: 4,
          at: '12:00',
          type: 'damage_report',
          payload: { sku: 'produce-lettuce', units: 3 },
        },
      ],
    });
    expect(r16create.status).toBe(201);
    const r16day = (await r16create.json()) as any;
    const r16events = await fetch(`${BASE()}/${r16day.data.id}/events`);
    expect(r16events.status).toBe(200);
    const eventsBody = (await r16events.json()) as any;
    const seqs16: number[] = eventsBody.data.map((e: any) => e.seq);
    expect(seqs16).toEqual([0, 1, 2]);
  });
});
