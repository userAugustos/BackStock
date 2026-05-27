import { describe, expect, test } from 'bun:test';

import { stubDecisionResolver } from '@api/modules/simulation/simulation.stubs';
import type { SimEvent, SimState } from '@api/modules/simulation/simulation.types';

describe('stub decision resolver', () => {
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

  test('inventory stub orders exactly 1 case', async () => {
    const event: SimEvent = {
      seq: 0,
      at: '08:12',
      type: 'sales_spike',
      payload: { sku: 'milk-2pct-gal', multiplier: 2.5 },
    };
    const decision = await stubDecisionResolver('inventory', baseState, event);
    expect(decision.agent).toBe('inventory');
    if (decision.agent !== 'inventory') throw new Error('wrong agent');
    expect(decision.order_cases).toBe(1);
    expect(decision.sku_id).toBe('milk-2pct-gal');
  });

  test('pricing stub keeps current price', async () => {
    const event: SimEvent = {
      seq: 3,
      at: '11:45',
      type: 'invoice_cost_change',
      payload: { sku: 'milk-2pct-gal', new_unit_cost: 3.1 },
    };
    const decision = await stubDecisionResolver('pricing', baseState, event);
    expect(decision.agent).toBe('pricing');
    if (decision.agent !== 'pricing') throw new Error('wrong agent');
    expect(decision.new_price).toBe(3.99);
    expect(decision.sku_id).toBe('milk-2pct-gal');
  });
});
