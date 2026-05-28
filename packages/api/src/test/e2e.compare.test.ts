import { describe, expect, test } from 'bun:test';

import { executeRun } from '@api/modules/runs/runs.worker';
import { config } from '@core/env';

import { setupE2ETests } from './e2e.setup';

setupE2ETests();

const DAYS_BASE = () => `${config.app.apiUrl}/days`;
const RUNS_BASE = () => `${config.app.apiUrl}/runs`;
const COMPARE_BASE = () => `${config.app.apiUrl}/compare`;

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
  { seq: 0, at: '08:12', type: 'sales_spike', payload: { sku: 'milk-2pct-gal', multiplier: 2.5 } },
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
      name: `e2e-compare-day-${crypto.randomUUID()}`,
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
      label: `e2e-compare-version-${crypto.randomUUID()}`,
      inventory_prompt_version: 'inv-v1',
      pricing_prompt_version: 'price-v1',
      model_id: 'stub-model',
    }),
  });
  const versionBody = (await versionRes.json()) as any;
  const versionId = versionBody.data.id;

  return { dayId, versionId };
}

async function createAndExecuteRun(dayId: string, versionId: string): Promise<string> {
  const res = await fetch(`${DAYS_BASE()}/${dayId}/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version_id: versionId }),
  });
  const body = (await res.json()) as any;
  await executeRun(body.data.id);
  return body.data.id;
}

describe('compare', () => {
  test('compare two runs of the same day: aligned timeline and impact deltas', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const runAId = await createAndExecuteRun(dayId, versionId);

    const branchRes = await fetch(`${RUNS_BASE()}/${runAId}/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 3,
        change: {
          type: 'decision_override',
          decision: {
            agent: 'pricing',
            sku_id: 'milk-2pct-gal',
            new_price: 5.99,
            summary: 'Override price',
          },
        },
      }),
    });
    const branchBody = (await branchRes.json()) as any;
    const runBId = branchBody.data.id;
    await executeRun(runBId);

    const compareRes = await fetch(`${COMPARE_BASE()}?run_a=${runAId}&run_b=${runBId}`);
    expect(compareRes.status).toBe(200);
    const compareBody = (await compareRes.json()) as any;

    expect(compareBody.data.day_id).toBe(dayId);
    expect(compareBody.data.runs).toHaveLength(2);
    expect(compareBody.data.divergence_seq).toBe(3);

    expect(compareBody.data.timeline.length).toBe(EVENTS.length + 1);
    for (const entry of compareBody.data.timeline) {
      expect(entry.steps[runAId]).toBeTruthy();
      expect(entry.steps[runBId]).toBeTruthy();
    }

    expect(compareBody.data.impact.per_run[runAId]).toBeTruthy();
    expect(compareBody.data.impact.per_run[runBId]).toBeTruthy();
    expect(compareBody.data.impact.deltas).toHaveLength(1);
    expect(compareBody.data.impact.deltas[0].pair).toEqual([runAId, runBId]);
    expect(typeof compareBody.data.impact.deltas[0].waste_pct).toBe('number');
    expect(typeof compareBody.data.impact.deltas[0].ending_margin_pct).toBe('number');
  });

  test('compare three runs', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const runAId = await createAndExecuteRun(dayId, versionId);

    const branch1Res = await fetch(`${RUNS_BASE()}/${runAId}/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 3,
        change: {
          type: 'decision_override',
          decision: {
            agent: 'pricing',
            sku_id: 'milk-2pct-gal',
            new_price: 5.99,
            summary: 'Branch 1',
          },
        },
      }),
    });
    const branch1Body = (await branch1Res.json()) as any;
    const runBId = branch1Body.data.id;
    await executeRun(runBId);

    const branch2Res = await fetch(`${RUNS_BASE()}/${runAId}/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 3,
        change: {
          type: 'decision_override',
          decision: {
            agent: 'pricing',
            sku_id: 'milk-2pct-gal',
            new_price: 2.99,
            summary: 'Branch 2',
          },
        },
      }),
    });
    const branch2Body = (await branch2Res.json()) as any;
    const runCId = branch2Body.data.id;
    await executeRun(runCId);

    const compareRes = await fetch(
      `${COMPARE_BASE()}?run_a=${runAId}&run_b=${runBId}&run_c=${runCId}`
    );
    expect(compareRes.status).toBe(200);
    const compareBody = (await compareRes.json()) as any;

    expect(compareBody.data.runs).toHaveLength(3);
    expect(compareBody.data.impact.deltas).toHaveLength(3);

    const pairs = compareBody.data.impact.deltas.map((d: any) => d.pair);
    expect(pairs).toContainEqual([runAId, runBId]);
    expect(pairs).toContainEqual([runAId, runCId]);
    expect(pairs).toContainEqual([runBId, runCId]);
  });

  test('compare runs from different days -> 400', async () => {
    const setup1 = await createDayAndVersion();
    const runAId = await createAndExecuteRun(setup1.dayId, setup1.versionId);

    const day2Res = await fetch(DAYS_BASE(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `e2e-compare-day2-${crypto.randomUUID()}`,
        seed_state: VALID_SEED_STATE,
        events: EVENTS,
      }),
    });
    const day2Body = (await day2Res.json()) as any;
    const runBId = await createAndExecuteRun(day2Body.data.id, setup1.versionId);

    const compareRes = await fetch(`${COMPARE_BASE()}?run_a=${runAId}&run_b=${runBId}`);
    expect(compareRes.status).toBe(400);
    const body = (await compareRes.json()) as any;
    expect(body.error).toBe('different_days');
  });

  test('compare with incomplete run -> 400', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const runAId = await createAndExecuteRun(dayId, versionId);

    const runBRes = await fetch(`${DAYS_BASE()}/${dayId}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version_id: versionId }),
    });
    const runBBody = (await runBRes.json()) as any;

    const compareRes = await fetch(`${COMPARE_BASE()}?run_a=${runAId}&run_b=${runBBody.data.id}`);
    expect(compareRes.status).toBe(400);
    const body = (await compareRes.json()) as any;
    expect(body.error).toBe('run_not_complete');
  });

  test('compare with nonexistent run -> 404', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const runAId = await createAndExecuteRun(dayId, versionId);

    const compareRes = await fetch(`${COMPARE_BASE()}?run_a=${runAId}&run_b=nonexistent-run-id`);
    expect(compareRes.status).toBe(404);
  });

  test('compare with only one run -> 422', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const runAId = await createAndExecuteRun(dayId, versionId);

    const compareRes = await fetch(`${COMPARE_BASE()}?run_a=${runAId}`);
    expect(compareRes.status).toBe(422);
  });

  test('compare with duplicate run IDs -> 400', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const runAId = await createAndExecuteRun(dayId, versionId);

    const compareRes = await fetch(`${COMPARE_BASE()}?run_a=${runAId}&run_b=${runAId}`);
    expect(compareRes.status).toBe(400);
    const body = (await compareRes.json()) as any;
    expect(body.error).toBe('duplicate_run_ids');
  });

  test('impact deltas are correct arithmetic', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const runAId = await createAndExecuteRun(dayId, versionId);

    const branchRes = await fetch(`${RUNS_BASE()}/${runAId}/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 3,
        change: {
          type: 'decision_override',
          decision: {
            agent: 'pricing',
            sku_id: 'milk-2pct-gal',
            new_price: 5.99,
            summary: 'Override',
          },
        },
      }),
    });
    const branchBody = (await branchRes.json()) as any;
    const runBId = branchBody.data.id;
    await executeRun(runBId);

    const compareRes = await fetch(`${COMPARE_BASE()}?run_a=${runAId}&run_b=${runBId}`);
    const compareBody = (await compareRes.json()) as any;

    const impactA = compareBody.data.impact.per_run[runAId];
    const impactB = compareBody.data.impact.per_run[runBId];
    const delta = compareBody.data.impact.deltas[0];

    const round = (x: number) => Math.round(x * 100) / 100;
    expect(delta.waste_pct).toBe(round(impactB.waste_pct - impactA.waste_pct));
    expect(delta.stockout_events).toBe(impactB.stockout_events - impactA.stockout_events);
    expect(delta.missed_revenue).toBe(round(impactB.missed_revenue - impactA.missed_revenue));
    expect(delta.ending_margin_pct).toBe(
      round(impactB.ending_margin_pct - impactA.ending_margin_pct)
    );
  });
});
