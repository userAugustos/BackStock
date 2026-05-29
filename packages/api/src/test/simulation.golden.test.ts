import { describe, expect, test } from 'bun:test';

import { buildInitialState, simulate } from '@api/modules/simulation/simulation.engine';
import { stubDecisionResolver } from '@api/modules/simulation/simulation.stubs';
import type { SeedState } from '@api/modules/days/days.schemas';
import type { SimEvent } from '@api/modules/simulation/simulation.types';

const heroSeedState: SeedState = {
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
  vendors: [{ id: 'dairy-co', lead_time_hours: 18, next_delivery_at: '10:00' }],
};

const heroEvents: SimEvent[] = [
  { seq: 0, at: '08:12', type: 'sales_spike', payload: { sku: 'milk-2pct-gal', multiplier: 2.5 } },
  { seq: 1, at: '09:03', type: 'vendor_delay', payload: { vendor: 'dairy-co', delay_hours: 6 } },
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

describe('simulation determinism', () => {
  test('same inputs produce identical output on every run', () => {
    const initial = buildInitialState(heroSeedState);
    const result1 = simulate(initial, heroEvents, stubDecisionResolver);
    const result2 = simulate(initial, heroEvents, stubDecisionResolver);

    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });

  test('hero day produces expected number of steps', () => {
    const initial = buildInitialState(heroSeedState);
    const result = simulate(initial, heroEvents, stubDecisionResolver);
    expect(result.steps).toHaveLength(heroEvents.length + 1);
  });

  test('hero day impact has valid structure', () => {
    const initial = buildInitialState(heroSeedState);
    const result = simulate(initial, heroEvents, stubDecisionResolver);
    const impact = result.impact;
    expect(typeof impact.waste_pct).toBe('number');
    expect(typeof impact.waste_value).toBe('number');
    expect(typeof impact.stockout_events).toBe('number');
    expect(typeof impact.missed_revenue).toBe('number');
    expect(typeof impact.ending_margin_pct).toBe('number');
    expect(typeof impact.ending_inventory_value).toBe('number');
    expect(impact.waste_pct).toBeGreaterThanOrEqual(0);
    expect(impact.waste_pct).toBeLessThanOrEqual(100);
    expect(impact.stockout_events).toBeGreaterThanOrEqual(0);
    expect(impact.missed_revenue).toBeGreaterThanOrEqual(0);
  });

  test('sales_spike reduces on_hand', () => {
    const initial = buildInitialState(heroSeedState);
    const result = simulate(initial, heroEvents, stubDecisionResolver);
    const step1 = result.steps[1]!;
    const milkAfterSpike = step1.state_snapshot.skus['milk-2pct-gal']!;
    expect(milkAfterSpike.on_hand).toBeLessThan(30);
    expect(milkAfterSpike.units_sold).toBeGreaterThan(0);
  });

  test('damage_report reduces on_hand and increases waste', () => {
    const initial = buildInitialState(heroSeedState);
    const result = simulate(initial, heroEvents, stubDecisionResolver);
    const stepBeforeDamage = result.steps[2]!;
    const stepAfterDamage = result.steps[3]!;
    const lettuceBefore = stepBeforeDamage.state_snapshot.skus['produce-lettuce']!;
    const lettuceAfter = stepAfterDamage.state_snapshot.skus['produce-lettuce']!;
    expect(lettuceAfter.on_hand).toBe(lettuceBefore.on_hand - 8);
    expect(lettuceAfter.units_wasted).toBe(lettuceBefore.units_wasted + 8);
  });

  test('invoice_cost_change updates unit_cost', () => {
    const initial = buildInitialState(heroSeedState);
    const result = simulate(initial, heroEvents, stubDecisionResolver);
    const stepAfterCost = result.steps[4]!;
    expect(stepAfterCost.state_snapshot.skus['milk-2pct-gal']!.unit_cost).toBe(3.1);
  });

  test('vendor_delay increases vendor delay_hours', () => {
    const initial = buildInitialState(heroSeedState);
    const result = simulate(initial, heroEvents, stubDecisionResolver);
    const stepAfterDelay = result.steps[2]!;
    expect(stepAfterDelay.state_snapshot.vendors['dairy-co']!.delay_hours).toBe(6);
  });

  test('decisions are recorded for decision points', () => {
    const initial = buildInitialState(heroSeedState);
    const result = simulate(initial, heroEvents, stubDecisionResolver);
    const inventoryDecisions = result.decisions.filter((d) => d.decision.agent === 'inventory');
    const pricingDecisions = result.decisions.filter((d) => d.decision.agent === 'pricing');
    expect(inventoryDecisions.length).toBeGreaterThanOrEqual(1);
    expect(pricingDecisions.length).toBeGreaterThanOrEqual(1);
  });

  test('manager_override approve transitions order to placed', () => {
    const initial = buildInitialState(heroSeedState);
    const result = simulate(initial, heroEvents, stubDecisionResolver);
    const finalStep = result.steps[result.steps.length - 1]!;
    const advancedOrders = finalStep.order_state.filter(
      (o) => o.status === 'placed' || o.status === 'in_transit' || o.status === 'delivered'
    );
    expect(advancedOrders.length).toBeGreaterThanOrEqual(1);
  });

  test('approved in-transit orders deliver inventory when vendor delivery time arrives', () => {
    const initial = buildInitialState({
      skus: [
        {
          id: 'milk-2pct-gal',
          on_hand: 6,
          price: 3.99,
          unit_cost: 2.8,
          shelf_life_hours: 96,
          case_size: 6,
        },
      ],
      vendors: [{ id: 'dairy-co', lead_time_hours: 1, next_delivery_at: '10:00' }],
    });
    const result = simulate(
      initial,
      [
        {
          seq: 0,
          at: '08:00',
          type: 'sales_spike',
          payload: { sku: 'milk-2pct-gal', multiplier: 20 },
        },
        {
          seq: 1,
          at: '09:00',
          type: 'manager_override',
          payload: { target: 'reorder', action: 'approve' },
        },
        { seq: 2, at: '11:00', type: 'damage_report', payload: { sku: 'milk-2pct-gal', units: 0 } },
      ],
      stubDecisionResolver
    );

    const final = result.steps[result.steps.length - 1]!;
    expect(final.state_snapshot.skus['milk-2pct-gal']!.units_delivered).toBe(6);
    expect(final.state_snapshot.skus['milk-2pct-gal']!.on_hand).toBe(6);
    expect(final.order_state[0]!.status).toBe('delivered');
    expect(result.impact.ending_inventory_value).toBe(16.8);
  });

  test('late orders deliver when the delayed vendor delivery time arrives', () => {
    const initial = buildInitialState({
      skus: [
        {
          id: 'milk-2pct-gal',
          on_hand: 6,
          price: 3.99,
          unit_cost: 2.8,
          shelf_life_hours: 96,
          case_size: 6,
        },
      ],
      vendors: [{ id: 'dairy-co', lead_time_hours: 1, next_delivery_at: '10:00' }],
    });
    const result = simulate(
      initial,
      [
        {
          seq: 0,
          at: '08:00',
          type: 'sales_spike',
          payload: { sku: 'milk-2pct-gal', multiplier: 20 },
        },
        {
          seq: 1,
          at: '09:00',
          type: 'manager_override',
          payload: { target: 'reorder', action: 'approve' },
        },
        {
          seq: 2,
          at: '09:30',
          type: 'vendor_delay',
          payload: { vendor: 'dairy-co', delay_hours: 12 },
        },
        { seq: 3, at: '21:00', type: 'damage_report', payload: { sku: 'milk-2pct-gal', units: 0 } },
        { seq: 4, at: '21:30', type: 'damage_report', payload: { sku: 'milk-2pct-gal', units: 0 } },
      ],
      stubDecisionResolver
    );

    expect(result.steps[4]!.order_state[0]!.status).toBe('late');
    const final = result.steps[result.steps.length - 1]!;
    expect(final.state_snapshot.skus['milk-2pct-gal']!.units_delivered).toBe(6);
    expect(final.order_state[0]!.status).toBe('delivered');
  });
});
