import { createActor, createMachine } from 'xstate';

import type { OrderFSMEvent, OrderState, OrderStatus } from './simulation.types';

const orderStates = {
  recommended: { on: { approve: 'placed', reject: 'rejected', modify: 'placed' } },
  placed: { on: { ship: 'in_transit' } },
  in_transit: { on: { deliver: 'delivered', delay: 'late' } },
  delivered: {},
  rejected: {},
  late: { on: { deliver: 'delivered', expire: 'missed' } },
  missed: {},
};

const createOrderMachine = (initial: OrderStatus) =>
  createMachine({
    id: 'orderLifecycle',
    types: {} as { events: OrderFSMEvent },
    initial,
    states: orderStates,
  });

export function advanceOrder(order: OrderState, event: OrderFSMEvent): OrderState {
  const actor = createActor(createOrderMachine(order.status));
  actor.start();
  actor.send(event);
  const nextStatus = actor.getSnapshot().value as OrderStatus;
  actor.stop();

  if (nextStatus === order.status) {
    throw new Error(`Illegal order transition: ${order.status} + ${event.type}`);
  }

  const quantity = event.type === 'modify' && 'quantity' in event ? event.quantity : order.quantity;
  return { ...order, status: nextStatus, quantity };
}

export function createOrder(
  skuId: string,
  vendorId: string,
  quantity: number,
  createdAtSeq: number
): OrderState {
  return {
    sku_id: skuId,
    vendor_id: vendorId,
    quantity,
    status: 'recommended',
    created_at_seq: createdAtSeq,
  };
}
