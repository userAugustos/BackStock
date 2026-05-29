import { describe, expect, test } from 'bun:test';

import { buildInitialState, simulate } from '@api/modules/simulation/simulation.engine';
import type { SeedState } from '@api/modules/days/days.schemas';
import type { DecisionResolver, SimEvent } from '@api/modules/simulation/simulation.types';

const seedState: SeedState = {
  skus: [
    {
      id: 'milk',
      on_hand: 6,
      price: 4,
      unit_cost: 2,
      shelf_life_hours: 48,
      case_size: 6,
    },
  ],
  vendors: [{ id: 'v1', lead_time_hours: 12, next_delivery_at: '10:00' }],
};

const salesSpike: SimEvent = {
  seq: 0,
  at: '08:00',
  type: 'sales_spike',
  payload: { sku: 'milk', multiplier: 5 },
};

const costChange: SimEvent = {
  seq: 0,
  at: '11:00',
  type: 'invoice_cost_change',
  payload: { sku: 'milk', new_unit_cost: 3 },
};

describe('simulation.engine — agent failure honesty (inventory)', () => {
  test('source failure: no order is pushed onto state.orders', async () => {
    const failureResolver: DecisionResolver = () => ({
      decision: { agent: 'inventory', sku_id: 'milk', order_cases: 0, summary: '' },
      raw_output: '',
      source: 'failure',
      valid: false,
      latency_ms: 0,
      failure_reason: 'llm_timeout',
    });

    const result = await simulate(buildInitialState(seedState), [salesSpike], failureResolver);
    const last = result.steps[result.steps.length - 1]!;

    expect(last.order_state).toEqual([]);
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]!.source).toBe('failure');
    expect(result.decisions[0]!.failure_reason).toBe('llm_timeout');
  });

  test('source llm with order_cases 0 (agent said do not order): no order is pushed', async () => {
    const zeroResolver: DecisionResolver = () => ({
      decision: {
        agent: 'inventory',
        sku_id: 'milk',
        order_cases: 0,
        summary: 'no need to order',
      },
      raw_output: '{}',
      source: 'llm',
      valid: true,
      latency_ms: 1,
    });

    const result = await simulate(buildInitialState(seedState), [salesSpike], zeroResolver);
    const last = result.steps[result.steps.length - 1]!;

    expect(last.order_state).toEqual([]);
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]!.source).toBe('llm');
  });

  test('source llm with order_cases > 0: order is pushed with quantity = cases × case_size', async () => {
    const positiveResolver: DecisionResolver = () => ({
      decision: {
        agent: 'inventory',
        sku_id: 'milk',
        order_cases: 2,
        summary: 'order 2 cases',
      },
      raw_output: '{}',
      source: 'llm',
      valid: true,
      latency_ms: 1,
    });

    const result = await simulate(buildInitialState(seedState), [salesSpike], positiveResolver);
    const last = result.steps[result.steps.length - 1]!;

    expect(last.order_state).toHaveLength(1);
    expect(last.order_state[0]!.quantity).toBe(12);
    expect(last.order_state[0]!.status).toBe('recommended');
  });
});

describe('simulation.engine — agent failure honesty (pricing)', () => {
  test('source failure: sku.price is NOT mutated (cost change still records)', async () => {
    const failureResolver: DecisionResolver = () => ({
      // new_price 0 is a sentinel: if the engine applied it, sku.price would become 0
      decision: { agent: 'pricing', sku_id: 'milk', new_price: 0, summary: '' },
      raw_output: '',
      source: 'failure',
      valid: false,
      latency_ms: 0,
      failure_reason: 'invalid_response',
    });

    const result = await simulate(buildInitialState(seedState), [costChange], failureResolver);
    const last = result.steps[result.steps.length - 1]!;

    expect(last.state_snapshot.skus['milk']!.price).toBe(4);
    expect(last.state_snapshot.skus['milk']!.unit_cost).toBe(3);
    expect(result.decisions[0]!.source).toBe('failure');
    expect(result.decisions[0]!.failure_reason).toBe('invalid_response');
  });

  test('source llm: sku.price is set to decision.new_price', async () => {
    const llmResolver: DecisionResolver = () => ({
      decision: {
        agent: 'pricing',
        sku_id: 'milk',
        new_price: 5.5,
        summary: 'protect margin',
      },
      raw_output: '{}',
      source: 'llm',
      valid: true,
      latency_ms: 1,
    });

    const result = await simulate(buildInitialState(seedState), [costChange], llmResolver);
    const last = result.steps[result.steps.length - 1]!;

    expect(last.state_snapshot.skus['milk']!.price).toBe(5.5);
  });
});
