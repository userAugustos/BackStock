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
      name: `e2e-branch-day-${crypto.randomUUID()}`,
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
      label: `e2e-branch-version-${crypto.randomUUID()}`,
      inventory_prompt_version: 'inv-v1',
      pricing_prompt_version: 'price-v1',
      model_id: 'stub-model',
    }),
  });
  const versionBody = (await versionRes.json()) as any;
  const versionId = versionBody.data.id;

  return { dayId, versionId };
}

async function createMissingPromptVersion() {
  const versionRes = await fetch(`${config.app.apiUrl}/versions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      label: `e2e-branch-degraded-version-${crypto.randomUUID()}`,
      inventory_prompt_version: 'inv-v1-does-not-exist',
      pricing_prompt_version: 'price-v1-does-not-exist',
      model_id: 'qwen-2.5-7b',
    }),
  });
  const versionBody = (await versionRes.json()) as any;
  return versionBody.data.id as string;
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

describe('branching', () => {
  test('counterfactual branch: override a pricing decision at seq 3', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const parentRunId = await createAndExecuteRun(dayId, versionId);

    const branchRes = await fetch(`${RUNS_BASE()}/${parentRunId}/branch`, {
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
            summary: 'Override: aggressive price hike',
          },
        },
      }),
    });
    expect(branchRes.status).toBe(201);
    const branchBody = (await branchRes.json()) as any;
    expect(branchBody.data.parent_run_id).toBe(parentRunId);
    expect(branchBody.data.fork_event_seq).toBe(3);
    expect(branchBody.data.fork_change.type).toBe('decision_override');
    expect(branchBody.data.status).toBe('queued');
    expect(branchBody.data.version_id).toBe(versionId);

    const childRunId = branchBody.data.id;
    await executeRun(childRunId);

    const childStatus = await fetch(`${RUNS_BASE()}/${childRunId}`);
    const childStatusBody = (await childStatus.json()) as any;
    expect(childStatusBody.data.status).toBe('done');

    const childDecisionRes = await fetch(`${RUNS_BASE()}/${childRunId}/decisions/3`);
    const childDecisionBody = (await childDecisionRes.json()) as any;
    expect(childDecisionBody.data.source).toBe('override');
    expect(childDecisionBody.data.parsed.new_price).toBe(5.99);

    const parentDecisionRes = await fetch(`${RUNS_BASE()}/${parentRunId}/decisions/3`);
    const parentDecisionBody = (await parentDecisionRes.json()) as any;
    expect(childDecisionBody.data.parsed.new_price).not.toBe(
      parentDecisionBody.data.parsed.new_price
    );
  });

  test('counterfactual branch: decisions before fork are reused from parent', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const parentRunId = await createAndExecuteRun(dayId, versionId);

    const branchRes = await fetch(`${RUNS_BASE()}/${parentRunId}/branch`, {
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
    const childRunId = branchBody.data.id;
    await executeRun(childRunId);

    const parentDecision0 = await fetch(`${RUNS_BASE()}/${parentRunId}/decisions/0`);
    const parentDec0Body = (await parentDecision0.json()) as any;

    const childDecision0 = await fetch(`${RUNS_BASE()}/${childRunId}/decisions/0`);
    const childDec0Body = (await childDecision0.json()) as any;

    expect(childDec0Body.data.source).toBe('reused');
    expect(childDec0Body.data.parsed).toEqual(parentDec0Body.data.parsed);
  });

  test('version branch: re-run entire day under new version', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const parentRunId = await createAndExecuteRun(dayId, versionId);

    const newVersionRes = await fetch(`${config.app.apiUrl}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: `e2e-branch-v2-${crypto.randomUUID()}`,
        inventory_prompt_version: 'inv-v2',
        pricing_prompt_version: 'price-v2',
        model_id: 'stub-model',
      }),
    });
    const newVersionBody = (await newVersionRes.json()) as any;
    const newVersionId = newVersionBody.data.id;

    const branchRes = await fetch(`${RUNS_BASE()}/${parentRunId}/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 0,
        change: { type: 'version', version_id: newVersionId },
      }),
    });
    expect(branchRes.status).toBe(201);
    const branchBody = (await branchRes.json()) as any;
    expect(branchBody.data.parent_run_id).toBe(parentRunId);
    expect(branchBody.data.fork_event_seq).toBe(0);
    expect(branchBody.data.fork_change.type).toBe('version');
    expect(branchBody.data.version_id).toBe(newVersionId);

    const childRunId = branchBody.data.id;
    await executeRun(childRunId);

    const childStatus = await fetch(`${RUNS_BASE()}/${childRunId}`);
    const childStatusBody = (await childStatus.json()) as any;
    expect(childStatusBody.data.status).toBe('done');

    const childTimeline = await fetch(`${RUNS_BASE()}/${childRunId}/timeline`);
    const childTimelineBody = (await childTimeline.json()) as any;
    expect(childTimelineBody.data.length).toBe(EVENTS.length + 1);
  });

  test('branch nonexistent parent run -> 404', async () => {
    const res = await fetch(`${RUNS_BASE()}/nonexistent-id/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 0,
        change: {
          type: 'decision_override',
          decision: {
            agent: 'inventory',
            sku_id: 'x',
            order_cases: 1,
            summary: 'x',
          },
        },
      }),
    });
    expect(res.status).toBe(404);
  });

  test('branch incomplete run -> 400', async () => {
    const { dayId, versionId } = await createDayAndVersion();

    const startRes = await fetch(`${DAYS_BASE()}/${dayId}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version_id: versionId }),
    });
    const startBody = (await startRes.json()) as any;

    const res = await fetch(`${RUNS_BASE()}/${startBody.data.id}/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 0,
        change: {
          type: 'decision_override',
          decision: {
            agent: 'inventory',
            sku_id: 'x',
            order_cases: 1,
            summary: 'x',
          },
        },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('run_not_complete');
  });

  test('branch accepts degraded completed parent and preserves reused failure state', async () => {
    const { dayId } = await createDayAndVersion();
    const degradedVersionId = await createMissingPromptVersion();
    const parentRunId = await createAndExecuteRun(dayId, degradedVersionId);

    const parentStatusRes = await fetch(`${RUNS_BASE()}/${parentRunId}`);
    const parentStatusBody = (await parentStatusRes.json()) as any;
    expect(parentStatusBody.data.status).toBe('done_degraded');

    const branchRes = await fetch(`${RUNS_BASE()}/${parentRunId}/branch`, {
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
            summary: 'Override degraded parent pricing decision',
          },
        },
      }),
    });
    expect(branchRes.status).toBe(201);
    const branchBody = (await branchRes.json()) as any;
    const childRunId = branchBody.data.id;

    await executeRun(childRunId);

    const childStatusRes = await fetch(`${RUNS_BASE()}/${childRunId}`);
    const childStatusBody = (await childStatusRes.json()) as any;
    expect(childStatusBody.data.status).toBe('done_degraded');
    expect(childStatusBody.data.decisions_failed).toBeGreaterThan(0);

    const childDecision0Res = await fetch(`${RUNS_BASE()}/${childRunId}/decisions/0`);
    const childDecision0Body = (await childDecision0Res.json()) as any;
    expect(childDecision0Body.data.source).toBe('reused');
    expect(childDecision0Body.data.valid).toBe(false);
    expect(childDecision0Body.data.failure_reason).toBe('prompt_missing');
  });

  test('branch with at_event_seq beyond max event -> 400', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const parentRunId = await createAndExecuteRun(dayId, versionId);

    const res = await fetch(`${RUNS_BASE()}/${parentRunId}/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 999,
        change: {
          type: 'decision_override',
          decision: {
            agent: 'inventory',
            sku_id: 'x',
            order_cases: 1,
            summary: 'x',
          },
        },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('invalid_fork_seq');
  });

  test('version branch with nonexistent version -> 404', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const parentRunId = await createAndExecuteRun(dayId, versionId);

    const res = await fetch(`${RUNS_BASE()}/${parentRunId}/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 0,
        change: { type: 'version', version_id: 'nonexistent-version' },
      }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe('version_not_found');
  });

  test('decision_override with wrong agent vs parent decision -> 400', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const parentRunId = await createAndExecuteRun(dayId, versionId);

    // seq 3 is invoice_cost_change -> parent decision is from the pricing agent.
    // Sending an inventory-shaped override here is a category error.
    const res = await fetch(`${RUNS_BASE()}/${parentRunId}/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 3,
        change: {
          type: 'decision_override',
          decision: {
            agent: 'inventory',
            sku_id: 'milk-2pct-gal',
            order_cases: 4,
            summary: 'wrong agent',
          },
        },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('override_agent_mismatch');
  });

  test('decision_override with wrong sku vs parent decision -> 400', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const parentRunId = await createAndExecuteRun(dayId, versionId);

    // Parent pricing decision at seq 3 is for milk-2pct-gal; overriding a different sku
    // would silently no-op in the engine, so the request must be rejected up front.
    const res = await fetch(`${RUNS_BASE()}/${parentRunId}/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 3,
        change: {
          type: 'decision_override',
          decision: {
            agent: 'pricing',
            sku_id: 'produce-lettuce',
            new_price: 2.5,
            summary: 'wrong sku',
          },
        },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('override_sku_mismatch');
  });

  test('determinism: branching at seq 0 with same version produces identical impact', async () => {
    const { dayId, versionId } = await createDayAndVersion();
    const parentRunId = await createAndExecuteRun(dayId, versionId);

    const branchRes = await fetch(`${RUNS_BASE()}/${parentRunId}/branch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at_event_seq: 0,
        change: { type: 'version', version_id: versionId },
      }),
    });
    const branchBody = (await branchRes.json()) as any;
    await executeRun(branchBody.data.id);

    const parentImpactRes = await fetch(`${RUNS_BASE()}/${parentRunId}/impact`);
    const parentImpact = (await parentImpactRes.json()) as any;
    const childImpactRes = await fetch(`${RUNS_BASE()}/${branchBody.data.id}/impact`);
    const childImpact = (await childImpactRes.json()) as any;

    expect(childImpact.data.waste_pct).toBe(parentImpact.data.waste_pct);
    expect(childImpact.data.waste_value).toBe(parentImpact.data.waste_value);
    expect(childImpact.data.stockout_events).toBe(parentImpact.data.stockout_events);
    expect(childImpact.data.missed_revenue).toBe(parentImpact.data.missed_revenue);
    expect(childImpact.data.ending_margin_pct).toBe(parentImpact.data.ending_margin_pct);
    expect(childImpact.data.ending_inventory_value).toBe(parentImpact.data.ending_inventory_value);
  });
});
