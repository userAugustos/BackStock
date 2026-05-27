import type { OrderFSMEvent, OrderState, OrderStatus } from './simulation.types';

type TransitionTable = Record<OrderStatus, Partial<Record<OrderFSMEvent['type'], OrderStatus>>>;

const transitions: TransitionTable = {
  recommended: { approve: 'placed', reject: 'rejected', modify: 'placed' },
  placed: { ship: 'in_transit' },
  in_transit: { deliver: 'delivered', delay: 'late' },
  delivered: {},
  rejected: {},
  late: { deliver: 'delivered', expire: 'missed' },
  missed: {},
};

export function advanceOrder(order: OrderState, event: OrderFSMEvent): OrderState {
  const allowed = transitions[order.status];
  const nextStatus = allowed[event.type];
  if (!nextStatus) {
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
