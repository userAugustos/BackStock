import { describe, expect, test } from 'bun:test';

import { createFakeLlmClient } from '@api/modules/agents/agents.llm-client.fake';
import { createLlmDecisionResolver } from '@api/modules/agents/agents.resolver';
import type { SimEvent, SimState } from '@api/modules/simulation/simulation.types';

const CATALOG_SKU_IDS = ['milk-2pct-gal', 'produce-lettuce'];
const baseState: SimState = {
  skus: {
    'milk-2pct-gal': {
      sku_id: 'milk-2pct-gal',
      on_hand: 10,
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
    'produce-lettuce': {
      sku_id: 'produce-lettuce',
      on_hand: 24,
      price: 1.99,
      unit_cost: 1.1,
      shelf_life_hours: 48,
      case_size: 12,
      units_sold: 0,
      units_wasted: 0,
      units_delivered: 0,
      stockout_events: 0,
      missed_revenue: 0,
      revenue: 0,
      cost_of_goods: 0,
    },
  },
  vendors: {
    'dairy-co': {
      vendor_id: 'dairy-co',
      lead_time_hours: 18,
      next_delivery_at: '10:00',
      delay_hours: 0,
    },
  },
  orders: [],
  current_time: '08:12',
};

const inventoryEvent: SimEvent = {
  seq: 0,
  at: '08:12',
  type: 'sales_spike',
  payload: { sku: 'milk-2pct-gal', multiplier: 2.5 },
};

const pricingEvent: SimEvent = {
  seq: 3,
  at: '11:45',
  type: 'invoice_cost_change',
  payload: { sku: 'milk-2pct-gal', new_unit_cost: 3.1 },
};

describe('createLlmDecisionResolver', () => {
  test('inventory: valid LLM response produces correct decision', async () => {
    const fake = createFakeLlmClient({
      response: JSON.stringify({
        order_cases: 24,
        sku: 'milk-2pct-gal',
        summary: 'Ordering 24 cases for spike',
      }),
    });
    const resolver = createLlmDecisionResolver({
      client: fake.client,
      catalogSkuIds: CATALOG_SKU_IDS,
      modelId: 'test-model',
      inventoryPromptVersion: 'inv-v1',
      pricingPromptVersion: 'price-v1',
    });

    const resolved = await resolver('inventory', baseState, inventoryEvent);
    const { decision } = resolved;
    expect(decision.agent).toBe('inventory');
    if (decision.agent !== 'inventory') throw new Error('wrong agent');
    expect(decision.order_cases).toBe(24);
    expect(decision.sku_id).toBe('milk-2pct-gal');
    expect(resolved.raw_output).toContain('order_cases');
    expect(resolved.valid).toBe(true);
    expect(resolved.source).toBe('llm');
  });

  test('pricing: valid LLM response produces correct decision', async () => {
    const fake = createFakeLlmClient({
      response: JSON.stringify({
        new_price: 4.29,
        sku: 'milk-2pct-gal',
        summary: 'Raising price to protect margin',
      }),
    });
    const resolver = createLlmDecisionResolver({
      client: fake.client,
      catalogSkuIds: CATALOG_SKU_IDS,
      modelId: 'test-model',
      inventoryPromptVersion: 'inv-v1',
      pricingPromptVersion: 'price-v1',
    });

    const resolved = await resolver('pricing', baseState, pricingEvent);
    const { decision } = resolved;
    expect(decision.agent).toBe('pricing');
    if (decision.agent !== 'pricing') throw new Error('wrong agent');
    expect(decision.new_price).toBe(4.29);
    expect(decision.sku_id).toBe('milk-2pct-gal');
    expect(resolved.valid).toBe(true);
  });

  test('pricing validation uses current context price', async () => {
    const context = structuredClone(baseState);
    context.skus['milk-2pct-gal']!.price = 10;
    const fake = createFakeLlmClient({
      response: JSON.stringify({
        new_price: 40,
        sku: 'milk-2pct-gal',
        summary: 'Raising price from current context price',
      }),
    });
    const resolver = createLlmDecisionResolver({
      client: fake.client,
      catalogSkuIds: CATALOG_SKU_IDS,
      modelId: 'test-model',
      inventoryPromptVersion: 'inv-v1',
      pricingPromptVersion: 'price-v1',
    });

    const resolved = await resolver('pricing', context, pricingEvent);
    const { decision } = resolved;
    expect(decision.agent).toBe('pricing');
    if (decision.agent !== 'pricing') throw new Error('wrong agent');
    expect(decision.new_price).toBe(40);
    expect(resolved.valid).toBe(true);
  });

  test('retries once on parse failure, succeeds on second try', async () => {
    let callCount = 0;
    const fake = createFakeLlmClient({
      response: () => {
        callCount++;
        if (callCount === 1) {
          return '{"order_cases": "not a number", "sku": "milk-2pct-gal", "summary": "bad"}';
        }
        return JSON.stringify({
          order_cases: 12,
          sku: 'milk-2pct-gal',
          summary: 'Fixed response',
        });
      },
    });
    const resolver = createLlmDecisionResolver({
      client: fake.client,
      catalogSkuIds: CATALOG_SKU_IDS,
      modelId: 'test-model',
      inventoryPromptVersion: 'inv-v1',
      pricingPromptVersion: 'price-v1',
    });

    const resolved = await resolver('inventory', baseState, inventoryEvent);
    const { decision } = resolved;
    expect(decision.agent).toBe('inventory');
    if (decision.agent !== 'inventory') throw new Error('wrong agent');
    expect(decision.order_cases).toBe(12);
    expect(resolved.valid).toBe(true);
    expect(fake.calls).toHaveLength(2);
  });

  test('falls back to safe default after retry also fails', async () => {
    const fake = createFakeLlmClient({
      response: 'totally invalid json !!@@##',
    });
    const resolver = createLlmDecisionResolver({
      client: fake.client,
      catalogSkuIds: CATALOG_SKU_IDS,
      modelId: 'test-model',
      inventoryPromptVersion: 'inv-v1',
      pricingPromptVersion: 'price-v1',
    });

    const resolved = await resolver('inventory', baseState, inventoryEvent);
    const { decision } = resolved;
    expect(decision.agent).toBe('inventory');
    if (decision.agent !== 'inventory') throw new Error('wrong agent');
    expect(decision.order_cases).toBe(0);
    expect(decision.summary).toContain('Fallback');
    expect(resolved.valid).toBe(false);
    expect(resolved.raw_output).toBe('totally invalid json !!@@##');
    expect(fake.calls).toHaveLength(2);
  });

  test('falls back on LLM client error (network failure)', async () => {
    const fake = createFakeLlmClient({ response: 'valid' });
    fake.client.chat = async () => {
      throw new Error('Network error');
    };
    const resolver = createLlmDecisionResolver({
      client: fake.client,
      catalogSkuIds: CATALOG_SKU_IDS,
      modelId: 'test-model',
      inventoryPromptVersion: 'inv-v1',
      pricingPromptVersion: 'price-v1',
    });

    const resolved = await resolver('inventory', baseState, inventoryEvent);
    const { decision } = resolved;
    expect(decision.agent).toBe('inventory');
    if (decision.agent !== 'inventory') throw new Error('wrong agent');
    expect(decision.order_cases).toBe(0);
    expect(decision.summary).toContain('Fallback');
    expect(resolved.valid).toBe(false);
  });

  test('falls back when LLM returns empty choices', async () => {
    const fake = createFakeLlmClient({ response: 'x' });
    fake.client.chat = async () => ({ choices: [] });
    const resolver = createLlmDecisionResolver({
      client: fake.client,
      catalogSkuIds: CATALOG_SKU_IDS,
      modelId: 'test-model',
      inventoryPromptVersion: 'inv-v1',
      pricingPromptVersion: 'price-v1',
    });

    const resolved = await resolver('inventory', baseState, inventoryEvent);
    const { decision } = resolved;
    expect(decision.agent).toBe('inventory');
    if (decision.agent !== 'inventory') throw new Error('wrong agent');
    expect(decision.order_cases).toBe(0);
    expect(resolved.valid).toBe(false);
  });

  test('sends system prompt + user context in messages', async () => {
    const fake = createFakeLlmClient({
      response: JSON.stringify({
        order_cases: 1,
        sku: 'milk-2pct-gal',
        summary: 'test',
      }),
    });
    const resolver = createLlmDecisionResolver({
      client: fake.client,
      catalogSkuIds: CATALOG_SKU_IDS,
      modelId: 'test-model',
      inventoryPromptVersion: 'inv-v1',
      pricingPromptVersion: 'price-v1',
    });

    await resolver('inventory', baseState, inventoryEvent);
    expect(fake.calls).toHaveLength(1);
    const messages = fake.calls[0]!.messages;
    expect(messages[0]!.role).toBe('system');
    expect(messages[1]!.role).toBe('user');
    expect(messages[1]!.content).toContain('milk-2pct-gal');
  });
});
