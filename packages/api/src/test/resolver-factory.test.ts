import { describe, expect, test } from 'bun:test';

import { createForkingResolver } from '@api/modules/runs/runs.resolver-factory';
import type {
  DecisionResolver,
  ResolvedDecision,
  SimEvent,
  SimState,
} from '@api/modules/simulation/simulation.types';

const EMPTY_STATE: SimState = {
  skus: {
    'milk-2pct-gal': {
      sku_id: 'milk-2pct-gal',
      on_hand: 30,
      price: 3.99,
      unit_cost: 2.8,
      shelf_life_hours: 96,
      case_size: 6,
      units_sold: 0,
      units_wasted: 0,
      units_delivered: 0,
      stockout_events: 0,
      missed_revenue: 0,
      revenue: 0,
      cost_of_goods: 0,
    },
  },
  vendors: {},
  orders: [],
  current_time: '08:00',
};

function makeEvent(seq: number): SimEvent {
  return {
    seq,
    at: '09:00',
    type: 'sales_spike',
    payload: { sku: 'milk-2pct-gal', multiplier: 2.0 },
  };
}

const PARENT_DECISION_SEQ0: ResolvedDecision = {
  decision: {
    agent: 'inventory',
    sku_id: 'milk-2pct-gal',
    order_cases: 4,
    summary: 'Parent decision at seq 0',
  },
  raw_output: '{"order_cases":4}',
  source: 'stub',
  valid: true,
  latency_ms: 0,
};

const PARENT_DECISION_SEQ3: ResolvedDecision = {
  decision: {
    agent: 'pricing',
    sku_id: 'milk-2pct-gal',
    new_price: 4.29,
    summary: 'Parent decision at seq 3',
  },
  raw_output: '{"new_price":4.29}',
  source: 'stub',
  valid: true,
  latency_ms: 0,
};

const BASE_RESOLVED: ResolvedDecision = {
  decision: {
    agent: 'inventory',
    sku_id: 'milk-2pct-gal',
    order_cases: 1,
    summary: 'Base resolver called',
  },
  raw_output: '{"order_cases":1}',
  source: 'stub',
  valid: true,
  latency_ms: 0,
};

const baseResolver: DecisionResolver = () => BASE_RESOLVED;

describe('createForkingResolver', () => {
  test('reuses parent decision before fork point', async () => {
    const parentDecisions = new Map<number, ResolvedDecision>();
    parentDecisions.set(0, PARENT_DECISION_SEQ0);
    parentDecisions.set(3, PARENT_DECISION_SEQ3);

    const resolver = createForkingResolver({
      parentDecisions,
      forkEventSeq: 3,
      forkChange: {
        type: 'decision_override',
        decision: {
          agent: 'pricing',
          sku_id: 'milk-2pct-gal',
          new_price: 5.0,
          summary: 'Override at fork',
        },
      },
      baseResolver,
    });

    const result = await resolver('inventory', EMPTY_STATE, makeEvent(0));
    expect(result.source).toBe('reused');
    expect(result.decision).toEqual(PARENT_DECISION_SEQ0.decision);
    expect(result.latency_ms).toBe(0);
  });

  test('applies decision override at fork point', async () => {
    const parentDecisions = new Map<number, ResolvedDecision>();
    parentDecisions.set(0, PARENT_DECISION_SEQ0);
    parentDecisions.set(3, PARENT_DECISION_SEQ3);

    const resolver = createForkingResolver({
      parentDecisions,
      forkEventSeq: 3,
      forkChange: {
        type: 'decision_override',
        decision: {
          agent: 'pricing',
          sku_id: 'milk-2pct-gal',
          new_price: 5.0,
          summary: 'Override at fork',
        },
      },
      baseResolver,
    });

    const result = await resolver('pricing', EMPTY_STATE, makeEvent(3));
    expect(result.source).toBe('override');
    expect(result.decision.agent).toBe('pricing');
    if (result.decision.agent === 'pricing') {
      expect(result.decision.new_price).toBe(5.0);
    }
  });

  test('calls base resolver after fork point', async () => {
    const parentDecisions = new Map<number, ResolvedDecision>();
    parentDecisions.set(0, PARENT_DECISION_SEQ0);

    const resolver = createForkingResolver({
      parentDecisions,
      forkEventSeq: 1,
      forkChange: {
        type: 'decision_override',
        decision: {
          agent: 'inventory',
          sku_id: 'milk-2pct-gal',
          order_cases: 10,
          summary: 'Override',
        },
      },
      baseResolver,
    });

    const result = await resolver('inventory', EMPTY_STATE, makeEvent(4));
    expect(result.source).toBe('stub');
    expect(result.decision).toEqual(BASE_RESOLVED.decision);
  });

  test('version fork at seq 0 calls base resolver for everything', async () => {
    const parentDecisions = new Map<number, ResolvedDecision>();
    parentDecisions.set(0, PARENT_DECISION_SEQ0);

    const resolver = createForkingResolver({
      parentDecisions,
      forkEventSeq: 0,
      forkChange: { type: 'version', version_id: 'new-version-id' },
      baseResolver,
    });

    const result = await resolver('inventory', EMPTY_STATE, makeEvent(0));
    expect(result.source).toBe('stub');
    expect(result.decision).toEqual(BASE_RESOLVED.decision);
  });

  test('version fork at seq 3 reuses before, recomputes at and after', async () => {
    const parentDecisions = new Map<number, ResolvedDecision>();
    parentDecisions.set(0, PARENT_DECISION_SEQ0);
    parentDecisions.set(3, PARENT_DECISION_SEQ3);

    const resolver = createForkingResolver({
      parentDecisions,
      forkEventSeq: 3,
      forkChange: { type: 'version', version_id: 'new-version-id' },
      baseResolver,
    });

    const beforeResult = await resolver('inventory', EMPTY_STATE, makeEvent(0));
    expect(beforeResult.source).toBe('reused');

    const atResult = await resolver('pricing', EMPTY_STATE, makeEvent(3));
    expect(atResult.source).toBe('stub');

    const afterResult = await resolver('inventory', EMPTY_STATE, makeEvent(5));
    expect(afterResult.source).toBe('stub');
  });

  test('reuse throws if parent decision missing for pre-fork seq', async () => {
    const parentDecisions = new Map<number, ResolvedDecision>();

    const resolver = createForkingResolver({
      parentDecisions,
      forkEventSeq: 5,
      forkChange: {
        type: 'decision_override',
        decision: {
          agent: 'inventory',
          sku_id: 'milk-2pct-gal',
          order_cases: 1,
          summary: 'x',
        },
      },
      baseResolver,
    });

    expect(() => resolver('inventory', EMPTY_STATE, makeEvent(0))).toThrow(
      /no parent decision found/i
    );
  });

  test('reused parent decision preserves original audit metadata', async () => {
    const parentDecisions = new Map<number, ResolvedDecision>();
    parentDecisions.set(0, {
      ...PARENT_DECISION_SEQ0,
      prompt_version: 'parent-inventory-v1',
      model_id: 'parent-model',
      failure_reason: 'prompt_missing',
      valid: false,
    } as ResolvedDecision & {
      prompt_version: string;
      model_id: string;
      failure_reason: 'prompt_missing';
    });

    const resolver = createForkingResolver({
      parentDecisions,
      forkEventSeq: 3,
      forkChange: {
        type: 'version',
        version_id: 'child-version-id',
      },
      baseResolver,
    });

    const result = (await resolver('inventory', EMPTY_STATE, makeEvent(0))) as ResolvedDecision & {
      prompt_version?: string;
      model_id?: string;
      failure_reason?: string;
    };

    expect(result.source).toBe('reused');
    expect(result.prompt_version).toBe('parent-inventory-v1');
    expect(result.model_id).toBe('parent-model');
    expect(result.failure_reason).toBe('prompt_missing');
    expect(result.valid).toBe(false);
  });
});
