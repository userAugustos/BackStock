import { describe, expect, test } from 'bun:test';

import { inventoryResponseSchema, pricingResponseSchema } from '@api/modules/agents/agents.schemas';

const CATALOG_SKUS = ['milk-2pct-gal', 'produce-lettuce'];
const CURRENT_PRICES: Record<string, number> = {
  'milk-2pct-gal': 3.99,
  'produce-lettuce': 1.99,
};

describe('inventoryResponseSchema', () => {
  test('accepts valid inventory response', () => {
    const schema = inventoryResponseSchema(CATALOG_SKUS);
    const result = schema.safeParse({
      order_cases: 24,
      sku: 'milk-2pct-gal',
      summary: 'Spike detected, ordering 24 cases',
    });
    expect(result.success).toBe(true);
  });

  test('rejects sku not in catalog', () => {
    const schema = inventoryResponseSchema(CATALOG_SKUS);
    const result = schema.safeParse({
      order_cases: 5,
      sku: 'nonexistent-sku',
      summary: 'test',
    });
    expect(result.success).toBe(false);
  });

  test('rejects negative order_cases', () => {
    const schema = inventoryResponseSchema(CATALOG_SKUS);
    const result = schema.safeParse({
      order_cases: -1,
      sku: 'milk-2pct-gal',
      summary: 'test',
    });
    expect(result.success).toBe(false);
  });

  test('accepts order_cases of 0', () => {
    const schema = inventoryResponseSchema(CATALOG_SKUS);
    const result = schema.safeParse({
      order_cases: 0,
      sku: 'milk-2pct-gal',
      summary: 'No order needed',
    });
    expect(result.success).toBe(true);
  });

  test('rejects non-integer order_cases', () => {
    const schema = inventoryResponseSchema(CATALOG_SKUS);
    const result = schema.safeParse({
      order_cases: 5.5,
      sku: 'milk-2pct-gal',
      summary: 'test',
    });
    expect(result.success).toBe(false);
  });

  test('rejects order_cases above max bound (1000)', () => {
    const schema = inventoryResponseSchema(CATALOG_SKUS);
    const result = schema.safeParse({
      order_cases: 1001,
      sku: 'milk-2pct-gal',
      summary: 'test',
    });
    expect(result.success).toBe(false);
  });
});

describe('pricingResponseSchema', () => {
  test('accepts valid pricing response', () => {
    const schema = pricingResponseSchema(CATALOG_SKUS, CURRENT_PRICES);
    const result = schema.safeParse({
      new_price: 4.29,
      sku: 'milk-2pct-gal',
      summary: 'Raising price to protect margin',
    });
    expect(result.success).toBe(true);
  });

  test('rejects sku not in catalog', () => {
    const schema = pricingResponseSchema(CATALOG_SKUS, CURRENT_PRICES);
    const result = schema.safeParse({
      new_price: 4.29,
      sku: 'nonexistent-sku',
      summary: 'test',
    });
    expect(result.success).toBe(false);
  });

  test('rejects zero price', () => {
    const schema = pricingResponseSchema(CATALOG_SKUS, CURRENT_PRICES);
    const result = schema.safeParse({
      new_price: 0,
      sku: 'milk-2pct-gal',
      summary: 'test',
    });
    expect(result.success).toBe(false);
  });

  test('rejects negative price', () => {
    const schema = pricingResponseSchema(CATALOG_SKUS, CURRENT_PRICES);
    const result = schema.safeParse({
      new_price: -1,
      sku: 'milk-2pct-gal',
      summary: 'test',
    });
    expect(result.success).toBe(false);
  });

  test('rejects price more than 5x current price', () => {
    const schema = pricingResponseSchema(CATALOG_SKUS, CURRENT_PRICES);
    const result = schema.safeParse({
      new_price: 20.0,
      sku: 'milk-2pct-gal',
      summary: 'test',
    });
    expect(result.success).toBe(false);
  });

  test('accepts price at boundary (5x current)', () => {
    const schema = pricingResponseSchema(CATALOG_SKUS, CURRENT_PRICES);
    const result = schema.safeParse({
      new_price: 19.95,
      sku: 'milk-2pct-gal',
      summary: 'test',
    });
    expect(result.success).toBe(true);
  });
});
