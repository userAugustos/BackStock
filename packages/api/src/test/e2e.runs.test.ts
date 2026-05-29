import { describe, expect, test } from 'bun:test';

import { executeRun } from '@api/modules/runs/runs.worker';
import { config } from '@core/env';

import { setupE2ETests } from './e2e.setup';

setupE2ETests();

const DAYS_BASE = () => `${config.app.apiUrl}/days`;
const RUNS_BASE = () => `${config.app.apiUrl}/runs`;

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

const EVENTS = [
  {
    seq: 0,
    at: '08:12',
    type: 'sales_spike',
    payload: { sku: 'milk-2pct-gal', multiplier: 2.5 },
  },
  { seq: 1, at: '09:03', type: 'vendor_delay', payload: { vendor: 'dairy-co', delay_hours: 6 } },
  { seq: 2, at: '10:20', type: 'damage_report', payload: { sku: 'produce-lettuce', units: 8 } },
  {
    seq: 3,
    at: '11:45',
    type: 'invoice_cost_change',
    payload: { sku: 'milk-2pct-gal', new_unit_cost: 3.1 },
  },
  {
    seq: 4,
    at: '14:10',
    type: 'promotion',
    payload: { sku: 'milk-2pct-gal', demand_multiplier: 1.8 },
  },
  {
    seq: 5,
    at: '17:30',
    type: 'manager_override',
    payload: { target: 'reorder', action: 'approve' },
  },
];

async function createDayAndVersion() {
  const dayRes = await fetch(DAYS_BASE(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: `e2e-run-day-${crypto.randomUUID()}`,
      seed_state: VALID_SEED_STATE,
      events: EVENTS,
    }),
  });
  const dayBody = (await dayRes.json()) as any;
  const dayId = dayBody.data.id;

  const versionRes = await fetch(`${config.app.apiUrl}/versions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      label: `e2e-version-${crypto.randomUUID()}`,
      inventory_prompt_version: 'inv-v1',
      pricing_prompt_version: 'price-v1',
      model_id: 'stub-model',
    }),
  });
  const versionBody = (await versionRes.json()) as any;
  const versionId = versionBody.data.id;

  return { dayId, versionId };
}

describe('runs', () => {
  test('full run lifecycle: create, execute, read status/timeline/impact/decision', async () => {
    const { dayId, versionId } = await createDayAndVersion();

    const startRes = await fetch(`${DAYS_BASE()}/${dayId}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version_id: versionId }),
    });
    expect(startRes.status).toBe(201);
    const startBody = (await startRes.json()) as any;
    expect(startBody.data.status).toBe('queued');
    expect(startBody.data.day_id).toBe(dayId);
    expect(startBody.data.version_id).toBe(versionId);
    const runId = startBody.data.id;

    const queuedRes = await fetch(`${RUNS_BASE()}/${runId}`);
    expect(queuedRes.status).toBe(200);
    const queuedBody = (await queuedRes.json()) as any;
    expect(queuedBody.data.status).toBe('queued');

    const timelinePremature = await fetch(`${RUNS_BASE()}/${runId}/timeline`);
    expect(timelinePremature.status).toBe(400);
    const timelinePrematureBody = (await timelinePremature.json()) as any;
    expect(timelinePrematureBody.error).toBe('run_not_complete');

    const impactPremature = await fetch(`${RUNS_BASE()}/${runId}/impact`);
    expect(impactPremature.status).toBe(400);

    await executeRun(runId);

    const doneRes = await fetch(`${RUNS_BASE()}/${runId}`);
    expect(doneRes.status).toBe(200);
    const doneBody = (await doneRes.json()) as any;
    expect(doneBody.data.status).toBe('done');
    expect(doneBody.data.completed_at).toBeTruthy();

    await executeRun(runId);
    const redeliveredRes = await fetch(`${RUNS_BASE()}/${runId}`);
    expect(redeliveredRes.status).toBe(200);
    const redeliveredBody = (await redeliveredRes.json()) as any;
    expect(redeliveredBody.data.status).toBe('done');

    const timelineRes = await fetch(`${RUNS_BASE()}/${runId}/timeline`);
    expect(timelineRes.status).toBe(200);
    const timelineBody = (await timelineRes.json()) as any;
    expect(timelineBody.data.length).toBe(EVENTS.length + 1);
    const seqs: number[] = timelineBody.data.map((s: any) => s.seq);
    expect(seqs).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(timelineBody.data[0].state_snapshot).toBeTruthy();
    expect(Array.isArray(timelineBody.data[0].order_state)).toBe(true);

    const impactRes = await fetch(`${RUNS_BASE()}/${runId}/impact`);
    expect(impactRes.status).toBe(200);
    const impactBody = (await impactRes.json()) as any;
    expect(typeof impactBody.data.waste_pct).toBe('number');
    expect(typeof impactBody.data.waste_value).toBe('number');
    expect(typeof impactBody.data.stockout_events).toBe('number');
    expect(typeof impactBody.data.missed_revenue).toBe('number');
    expect(typeof impactBody.data.ending_margin_pct).toBe('number');
    expect(typeof impactBody.data.ending_inventory_value).toBe('number');

    const decisionRes = await fetch(`${RUNS_BASE()}/${runId}/decisions/3`);
    expect(decisionRes.status).toBe(200);
    const decisionBody = (await decisionRes.json()) as any;
    expect(decisionBody.data.event_seq).toBe(3);
    expect(decisionBody.data.agent).toBe('pricing');
    expect(decisionBody.data.source).toBe('stub');
    expect(decisionBody.data.valid).toBe(true);
    expect(decisionBody.data.parsed).toBeTruthy();
  });

  test('POST /days/:id/runs with nonexistent day -> 404', async () => {
    const res = await fetch(`${DAYS_BASE()}/nonexistent-id/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version_id: 'some-version' }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe('day_not_found');
  });

  test('POST /days/:id/runs with nonexistent version -> 404', async () => {
    const dayRes = await fetch(DAYS_BASE(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `version-404-day-${crypto.randomUUID()}`,
        seed_state: VALID_SEED_STATE,
        events: [
          {
            seq: 0,
            at: '08:00',
            type: 'sales_spike',
            payload: { sku: 'milk-2pct-gal', multiplier: 1.5 },
          },
        ],
      }),
    });
    const dayBody = (await dayRes.json()) as any;

    const res = await fetch(`${DAYS_BASE()}/${dayBody.data.id}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version_id: 'nonexistent-version' }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe('version_not_found');
  });

  test('GET /runs/:id with nonexistent run -> 404', async () => {
    const res = await fetch(`${RUNS_BASE()}/nonexistent-run`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe('run_not_found');
  });

  test('determinism: two runs of the same day produce identical impact', async () => {
    const { dayId, versionId } = await createDayAndVersion();

    const r1 = await fetch(`${DAYS_BASE()}/${dayId}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version_id: versionId }),
    });
    const run1 = (await r1.json()) as any;
    await executeRun(run1.data.id);

    const r2 = await fetch(`${DAYS_BASE()}/${dayId}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version_id: versionId }),
    });
    const run2 = (await r2.json()) as any;
    await executeRun(run2.data.id);

    const impact1Res = await fetch(`${RUNS_BASE()}/${run1.data.id}/impact`);
    const impact1 = (await impact1Res.json()) as any;
    const impact2Res = await fetch(`${RUNS_BASE()}/${run2.data.id}/impact`);
    const impact2 = (await impact2Res.json()) as any;

    expect(impact1.data.waste_pct).toBe(impact2.data.waste_pct);
    expect(impact1.data.waste_value).toBe(impact2.data.waste_value);
    expect(impact1.data.stockout_events).toBe(impact2.data.stockout_events);
    expect(impact1.data.missed_revenue).toBe(impact2.data.missed_revenue);
    expect(impact1.data.ending_margin_pct).toBe(impact2.data.ending_margin_pct);
    expect(impact1.data.ending_inventory_value).toBe(impact2.data.ending_inventory_value);

    const tl1Res = await fetch(`${RUNS_BASE()}/${run1.data.id}/timeline`);
    const tl1 = (await tl1Res.json()) as any;
    const tl2Res = await fetch(`${RUNS_BASE()}/${run2.data.id}/timeline`);
    const tl2 = (await tl2Res.json()) as any;

    expect(tl1.data.length).toBe(tl2.data.length);
    for (let i = 0; i < tl1.data.length; i++) {
      expect(JSON.stringify(tl1.data[i].state_snapshot)).toBe(
        JSON.stringify(tl2.data[i].state_snapshot)
      );
    }
  });
});
