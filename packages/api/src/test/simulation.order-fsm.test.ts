import { describe, expect, test } from 'bun:test';

import { advanceOrder, createOrder } from '@api/modules/simulation/simulation.order-fsm';
import type { OrderState } from '@api/modules/simulation/simulation.types';

describe('order lifecycle FSM', () => {
  const base: OrderState = {
    sku_id: 'milk-2pct-gal',
    vendor_id: 'dairy-co',
    quantity: 6,
    status: 'recommended',
    created_at_seq: 0,
  };

  test('recommended + approve -> placed', () => {
    const next = advanceOrder(base, { type: 'approve' });
    expect(next.status).toBe('placed');
    expect(next.quantity).toBe(6);
  });

  test('recommended + reject -> rejected', () => {
    const next = advanceOrder(base, { type: 'reject' });
    expect(next.status).toBe('rejected');
  });

  test('recommended + modify -> placed with new quantity', () => {
    const next = advanceOrder(base, { type: 'modify', quantity: 12 });
    expect(next.status).toBe('placed');
    expect(next.quantity).toBe(12);
  });

  test('placed + ship -> in_transit', () => {
    const placed = { ...base, status: 'placed' as const };
    const next = advanceOrder(placed, { type: 'ship' });
    expect(next.status).toBe('in_transit');
  });

  test('in_transit + deliver -> delivered', () => {
    const inTransit = { ...base, status: 'in_transit' as const };
    const next = advanceOrder(inTransit, { type: 'deliver' });
    expect(next.status).toBe('delivered');
  });

  test('in_transit + delay -> late', () => {
    const inTransit = { ...base, status: 'in_transit' as const };
    const next = advanceOrder(inTransit, { type: 'delay' });
    expect(next.status).toBe('late');
  });

  test('late + deliver -> delivered', () => {
    const late = { ...base, status: 'late' as const };
    const next = advanceOrder(late, { type: 'deliver' });
    expect(next.status).toBe('delivered');
  });

  test('late + expire -> missed', () => {
    const late = { ...base, status: 'late' as const };
    const next = advanceOrder(late, { type: 'expire' });
    expect(next.status).toBe('missed');
  });

  test('illegal transition throws', () => {
    expect(() => advanceOrder(base, { type: 'deliver' })).toThrow();
    expect(() =>
      advanceOrder({ ...base, status: 'rejected' as const }, { type: 'approve' })
    ).toThrow();
    expect(() =>
      advanceOrder({ ...base, status: 'delivered' as const }, { type: 'ship' })
    ).toThrow();
    expect(() =>
      advanceOrder({ ...base, status: 'missed' as const }, { type: 'deliver' })
    ).toThrow();
  });

  test('createOrder returns recommended status', () => {
    const order = createOrder('milk-2pct-gal', 'dairy-co', 6, 0);
    expect(order.status).toBe('recommended');
    expect(order.sku_id).toBe('milk-2pct-gal');
    expect(order.quantity).toBe(6);
    expect(order.created_at_seq).toBe(0);
  });
});
