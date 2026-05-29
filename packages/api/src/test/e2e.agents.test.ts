import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { executeRun } from '@api/modules/runs/runs.worker';
import { config } from '@core/env';

import { setupE2ETests } from './e2e.setup';

setupE2ETests();

const DAYS_BASE = () => `${config.app.apiUrl}/days`;
const RUNS_BASE = () => `${config.app.apiUrl}/runs`;

const DECISION_SEED_STATE = {
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

const DECISION_EVENTS = [
  {
    seq: 0,
    at: '08:12',
    type: 'sales_spike',
    payload: { sku: 'milk-2pct-gal', multiplier: 2.5 },
  },
  {
    seq: 1,
    at: '09:03',
    type: 'vendor_delay',
    payload: { vendor: 'dairy-co', delay_hours: 6 },
  },
  {
    seq: 2,
    at: '10:20',
    type: 'damage_report',
    payload: { sku: 'produce-lettuce', units: 8 },
  },
  {
    seq: 3,
    at: '11:45',
    type: 'invoice_cost_change',
    payload: { sku: 'milk-2pct-gal', new_unit_cost: 3.1 },
  },
];

const IMPACT_SEED_STATE = {
  skus: [
    {
      id: 'milk-2pct-gal',
      on_hand: 200,
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

const IMPACT_EVENTS = [
  {
    seq: 0,
    at: '08:30',
    type: 'invoice_cost_change',
    payload: { sku: 'milk-2pct-gal', new_unit_cost: 3.1 },
  },
  {
    seq: 1,
    at: '12:00',
    type: 'promotion',
    payload: { sku: 'milk-2pct-gal', demand_multiplier: 2.0 },
  },
];

let fakeLlmServer: ReturnType<typeof Bun.serve>;
const FAKE_LLM_PORT = 19878;

beforeAll(() => {
  fakeLlmServer = Bun.serve({
    port: FAKE_LLM_PORT,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/v1/chat/completions') {
        return req.json().then((body: any) => {
          const userMsg = body.messages?.[1]?.content ?? '';
          const parsed = typeof userMsg === 'string' ? JSON.parse(userMsg) : userMsg;
          const agentType = parsed.agent_type;

          if (agentType === 'inventory') {
            return Response.json({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({
                      order_cases: 18,
                      sku: 'milk-2pct-gal',
                      summary: 'Fake LLM: ordering 18 cases for test',
                    }),
                  },
                  finish_reason: 'stop',
                },
              ],
            });
          }

          return Response.json({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    new_price: 4.49,
                    sku: 'milk-2pct-gal',
                    summary: 'Fake LLM: raising price for test',
                  }),
                },
                finish_reason: 'stop',
              },
            ],
          });
        });
      }
      return new Response('Not found', { status: 404 });
    },
  });

  (config.llm as any).url = `http://localhost:${FAKE_LLM_PORT}`;
  (config.llm as any).token = 'fake-test-token';
});

afterAll(async () => {
  await fakeLlmServer.stop(true);
  (config.llm as any).url = '';
  (config.llm as any).token = '';
});

async function createLlmVersion() {
  const versionRes = await fetch(`${config.app.apiUrl}/versions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      label: `e2e-llm-version-${crypto.randomUUID()}`,
      inventory_prompt_version: 'inv-v1',
      pricing_prompt_version: 'price-v1',
      model_id: 'qwen-2.5-7b',
    }),
  });
  const versionBody = (await versionRes.json()) as any;
  return versionBody.data.id as string;
}

async function createDay(seedState: object, events: object[]) {
  const dayRes = await fetch(DAYS_BASE(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: `e2e-llm-day-${crypto.randomUUID()}`,
      seed_state: seedState,
      events,
    }),
  });
  const dayBody = (await dayRes.json()) as any;
  return dayBody.data.id as string;
}

async function startAndExecuteRun(dayId: string, versionId: string) {
  const res = await fetch(`${DAYS_BASE()}/${dayId}/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version_id: versionId }),
  });
  const body = (await res.json()) as any;
  const runId = body.data.id as string;
  await executeRun(runId);
  return runId;
}

describe('LLM agent integration', () => {
  test('run with LLM version produces decisions from fake LLM', async () => {
    const dayId = await createDay(DECISION_SEED_STATE, DECISION_EVENTS);
    const versionId = await createLlmVersion();

    const startRes = await fetch(`${DAYS_BASE()}/${dayId}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version_id: versionId }),
    });
    expect(startRes.status).toBe(201);
    const startBody = (await startRes.json()) as any;
    const runId = startBody.data.id;

    await executeRun(runId);

    const doneRes = await fetch(`${RUNS_BASE()}/${runId}`);
    const doneBody = (await doneRes.json()) as any;
    expect(doneBody.data.status).toBe('done');

    const impactRes = await fetch(`${RUNS_BASE()}/${runId}/impact`);
    expect(impactRes.status).toBe(200);
    const impactBody = (await impactRes.json()) as any;
    expect(typeof impactBody.data.waste_pct).toBe('number');

    const invDecisionRes = await fetch(`${RUNS_BASE()}/${runId}/decisions/0`);
    expect(invDecisionRes.status).toBe(200);
    const invDecision = (await invDecisionRes.json()) as any;
    expect(invDecision.data.agent).toBe('inventory');
    expect(invDecision.data.source).toBe('llm');
    const invParsed = invDecision.data.parsed;
    expect(invParsed.order_cases).toBe(18);

    const priceDecisionRes = await fetch(`${RUNS_BASE()}/${runId}/decisions/3`);
    expect(priceDecisionRes.status).toBe(200);
    const priceDecision = (await priceDecisionRes.json()) as any;
    expect(priceDecision.data.agent).toBe('pricing');
    expect(priceDecision.data.source).toBe('llm');
    const priceParsed = priceDecision.data.parsed;
    expect(priceParsed.new_price).toBe(4.49);
  });

  test('LLM run impact differs from stub run impact', async () => {
    const dayId = await createDay(IMPACT_SEED_STATE, IMPACT_EVENTS);
    const llmVersionId = await createLlmVersion();

    const stubVersionRes = await fetch(`${config.app.apiUrl}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: `e2e-stub-compare-${crypto.randomUUID()}`,
        inventory_prompt_version: 'inv-v1',
        pricing_prompt_version: 'price-v1',
        model_id: 'stub-model',
      }),
    });
    const stubVersionBody = (await stubVersionRes.json()) as any;
    const stubVersionId = stubVersionBody.data.id;

    const llmRunId = await startAndExecuteRun(dayId, llmVersionId);
    const stubRunId = await startAndExecuteRun(dayId, stubVersionId);

    const llmImpact = (await fetch(`${RUNS_BASE()}/${llmRunId}/impact`).then((r) =>
      r.json()
    )) as any;
    const stubImpact = (await fetch(`${RUNS_BASE()}/${stubRunId}/impact`).then((r) =>
      r.json()
    )) as any;

    const llmData = llmImpact.data;
    const stubData = stubImpact.data;
    const differs =
      llmData.waste_pct !== stubData.waste_pct ||
      llmData.stockout_events !== stubData.stockout_events ||
      llmData.missed_revenue !== stubData.missed_revenue ||
      llmData.ending_margin_pct !== stubData.ending_margin_pct;
    expect(differs).toBe(true);
  });

  test('LLM run with same fake is deterministic', async () => {
    const dayId = await createDay(IMPACT_SEED_STATE, IMPACT_EVENTS);
    const versionId = await createLlmVersion();

    const runId1 = await startAndExecuteRun(dayId, versionId);
    const runId2 = await startAndExecuteRun(dayId, versionId);

    const i1 = (await fetch(`${RUNS_BASE()}/${runId1}/impact`).then((r) => r.json())) as any;
    const i2 = (await fetch(`${RUNS_BASE()}/${runId2}/impact`).then((r) => r.json())) as any;

    expect(i1.data.waste_pct).toBe(i2.data.waste_pct);
    expect(i1.data.stockout_events).toBe(i2.data.stockout_events);
    expect(i1.data.missed_revenue).toBe(i2.data.missed_revenue);
    expect(i1.data.ending_margin_pct).toBe(i2.data.ending_margin_pct);
  });
});
