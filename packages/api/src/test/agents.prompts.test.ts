import { describe, expect, test } from 'bun:test';

import { getPrompt } from '@api/modules/agents/agents.prompts';

describe('prompt registry', () => {
  test('returns inventory prompt for known version', () => {
    const entry = getPrompt('inventory', 'inv-v1');
    expect(entry).toBeDefined();
    expect(entry!.agent).toBe('inventory');
    expect(entry!.version).toBe('inv-v1');
    expect(entry!.system).toContain('inventory');
  });

  test('returns pricing prompt for known version', () => {
    const entry = getPrompt('pricing', 'price-v1');
    expect(entry).toBeDefined();
    expect(entry!.agent).toBe('pricing');
    expect(entry!.version).toBe('price-v1');
    expect(entry!.system).toContain('pricing');
  });

  test('returns undefined for unknown version', () => {
    const entry = getPrompt('inventory', 'nonexistent-v99');
    expect(entry).toBeUndefined();
  });

  test('inventory prompt instructs JSON response with order_cases, sku, summary', () => {
    const entry = getPrompt('inventory', 'inv-v1');
    expect(entry!.system).toContain('order_cases');
    expect(entry!.system).toContain('sku');
    expect(entry!.system).toContain('summary');
  });

  test('pricing prompt instructs JSON response with new_price, sku, summary', () => {
    const entry = getPrompt('pricing', 'price-v1');
    expect(entry!.system).toContain('new_price');
    expect(entry!.system).toContain('sku');
    expect(entry!.system).toContain('summary');
  });
});
