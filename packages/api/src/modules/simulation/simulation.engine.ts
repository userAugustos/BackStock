import type { SeedState } from '@api/modules/days/days.schemas';

import { advanceOrder, createOrder } from './simulation.order-fsm';
import { DAY_HOURS, STORE_CLOSE_HOUR } from './simulation.types';
import type {
  DamageReportPayload,
  DecisionResolver,
  Impact,
  InvoiceCostChangePayload,
  ManagerOverridePayload,
  PromotionPayload,
  RunStep,
  SalesSpikePayload,
  SimEvent,
  SimState,
  SimulationResult,
  VendorDelayPayload,
} from './simulation.types';

function roundMoney(x: number): number {
  return Math.round(x * 100) / 100;
}

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! + m! / 60;
}

function formatTime(hours: number): string {
  let h = Math.floor(hours);
  let m = Math.round((hours - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function buildInitialState(seedState: SeedState): SimState {
  const skus: SimState['skus'] = {};
  for (const sku of seedState.skus) {
    skus[sku.id] = {
      sku_id: sku.id,
      on_hand: sku.on_hand,
      price: sku.price,
      unit_cost: sku.unit_cost,
      shelf_life_hours: sku.shelf_life_hours,
      case_size: sku.case_size,
      units_sold: 0,
      units_wasted: 0,
      units_delivered: 0,
      stockout_events: 0,
      missed_revenue: 0,
      revenue: 0,
      cost_of_goods: 0,
    };
  }

  const vendors: SimState['vendors'] = {};
  for (const vendor of seedState.vendors) {
    vendors[vendor.id] = {
      vendor_id: vendor.id,
      lead_time_hours: vendor.lead_time_hours,
      next_delivery_at: vendor.next_delivery_at,
      delay_hours: 0,
    };
  }

  return {
    skus,
    vendors,
    orders: [],
    current_time: '08:00',
  };
}

interface EngineContext {
  initialState: SimState;
  resolver: DecisionResolver;
  decisions: SimulationResult['decisions'];
}

function applySalesEvent(
  state: SimState,
  skuId: string,
  multiplier: number,
  ctx: EngineContext,
  event: SimEvent
): void {
  const sku = state.skus[skuId];
  if (!sku) return;

  const eventHour = parseTime(event.at);
  const remainingHours = STORE_CLOSE_HOUR - eventHour;
  if (remainingHours <= 0) return;

  const initialOnHand = ctx.initialState.skus[skuId]?.on_hand ?? sku.on_hand;
  const baseHourlyRate = initialOnHand / DAY_HOURS;
  const unitsToSell = Math.floor(baseHourlyRate * multiplier * remainingHours);

  if (unitsToSell > sku.on_hand) {
    const missedUnits = unitsToSell - sku.on_hand;
    sku.missed_revenue = roundMoney(sku.missed_revenue + missedUnits * sku.price);
    sku.revenue = roundMoney(sku.revenue + sku.on_hand * sku.price);
    sku.cost_of_goods = roundMoney(sku.cost_of_goods + sku.on_hand * sku.unit_cost);
    sku.units_sold += sku.on_hand;
    sku.on_hand = 0;
    sku.stockout_events += 1;
  } else {
    sku.on_hand -= unitsToSell;
    sku.units_sold += unitsToSell;
    sku.revenue = roundMoney(sku.revenue + unitsToSell * sku.price);
    sku.cost_of_goods = roundMoney(sku.cost_of_goods + unitsToSell * sku.unit_cost);
  }

  if (sku.on_hand < sku.case_size) {
    const decision = ctx.resolver('inventory', structuredClone(state), event);
    ctx.decisions.push({
      event_seq: event.seq,
      decision,
      context_snapshot: structuredClone(state),
    });

    if (decision.agent === 'inventory') {
      const orderQuantity = decision.order_cases * sku.case_size;
      const vendorId = Object.keys(state.vendors)[0] ?? 'unknown';
      const order = createOrder(skuId, vendorId, orderQuantity, event.seq);
      state.orders.push(order);
    }
  }
}

function applySalesSpike(state: SimState, event: SimEvent, ctx: EngineContext): void {
  const payload = event.payload as SalesSpikePayload;
  applySalesEvent(state, payload.sku, payload.multiplier, ctx, event);
}

function applyPromotion(state: SimState, event: SimEvent, ctx: EngineContext): void {
  const payload = event.payload as PromotionPayload;
  applySalesEvent(state, payload.sku, payload.demand_multiplier, ctx, event);
}

function applyVendorDelay(state: SimState, event: SimEvent): void {
  const payload = event.payload as VendorDelayPayload;
  const vendor = state.vendors[payload.vendor];
  if (!vendor) return;

  vendor.delay_hours += payload.delay_hours;
  const currentDelivery = parseTime(vendor.next_delivery_at);
  const newDelivery = currentDelivery + payload.delay_hours;
  vendor.next_delivery_at = formatTime(newDelivery);

  for (let i = 0; i < state.orders.length; i++) {
    const order = state.orders[i]!;
    if (order.vendor_id !== payload.vendor) continue;
    if (order.status === 'in_transit') {
      if (newDelivery >= STORE_CLOSE_HOUR) {
        state.orders[i] = advanceOrder(order, { type: 'delay' });
      }
    } else if (order.status === 'late') {
      if (newDelivery > 24) {
        state.orders[i] = advanceOrder(order, { type: 'expire' });
      }
    }
  }
}

function applyDamageReport(state: SimState, event: SimEvent): void {
  const payload = event.payload as DamageReportPayload;
  const sku = state.skus[payload.sku];
  if (!sku) return;

  const damaged = Math.min(payload.units, sku.on_hand);
  sku.on_hand = Math.max(0, sku.on_hand - payload.units);
  sku.units_wasted += damaged;
}

function applyInvoiceCostChange(state: SimState, event: SimEvent, ctx: EngineContext): void {
  const payload = event.payload as InvoiceCostChangePayload;
  const sku = state.skus[payload.sku];
  if (!sku) return;

  sku.unit_cost = payload.new_unit_cost;

  const decision = ctx.resolver('pricing', structuredClone(state), event);
  ctx.decisions.push({
    event_seq: event.seq,
    decision,
    context_snapshot: structuredClone(state),
  });

  if (decision.agent === 'pricing') {
    sku.price = decision.new_price;
  }
}

function applyManagerOverride(state: SimState, event: SimEvent): void {
  const payload = event.payload as ManagerOverridePayload;

  if (payload.target === 'reorder') {
    const recommended = state.orders
      .filter((o) => o.status === 'recommended')
      .sort((a, b) => b.created_at_seq - a.created_at_seq);

    if (recommended.length === 0) return;

    const target = recommended[0]!;
    const targetIdx = state.orders.indexOf(target);

    if (payload.action === 'approve') {
      const placed = advanceOrder(target, { type: 'approve' });
      const shipped = advanceOrder(placed, { type: 'ship' });
      state.orders[targetIdx] = shipped;
    } else if (payload.action === 'reject') {
      state.orders[targetIdx] = advanceOrder(target, { type: 'reject' });
    } else if (payload.action === 'modify') {
      const modPayload = payload as unknown as {
        target: string;
        action: string;
        quantity?: number;
      };
      const qty = modPayload.quantity ?? target.quantity;
      const placed = advanceOrder(target, { type: 'modify', quantity: qty });
      const shipped = advanceOrder(placed, { type: 'ship' });
      state.orders[targetIdx] = shipped;
    }
  }
}

function computeImpact(initialState: SimState, finalState: SimState): Impact {
  let totalStartingInventory = 0;
  let totalUnitsWasted = 0;
  let totalWasteValue = 0;
  let totalStockoutEvents = 0;
  let totalMissedRevenue = 0;
  let totalRevenue = 0;
  let totalCogs = 0;
  let endingInventoryValue = 0;

  for (const skuId of Object.keys(finalState.skus)) {
    const sku = finalState.skus[skuId]!;
    const initialSku = initialState.skus[skuId]!;

    totalStartingInventory += initialSku.on_hand;
    totalUnitsWasted += sku.units_wasted;
    totalWasteValue = roundMoney(totalWasteValue + sku.units_wasted * sku.unit_cost);
    totalStockoutEvents += sku.stockout_events;
    totalMissedRevenue = roundMoney(totalMissedRevenue + sku.missed_revenue);
    totalRevenue = roundMoney(totalRevenue + sku.revenue);
    totalCogs = roundMoney(totalCogs + sku.cost_of_goods);
    endingInventoryValue = roundMoney(endingInventoryValue + sku.on_hand * sku.unit_cost);
  }

  const wastePct =
    totalStartingInventory > 0 ? roundMoney((totalUnitsWasted / totalStartingInventory) * 100) : 0;

  const endingMarginPct =
    totalRevenue > 0 ? roundMoney(((totalRevenue - totalCogs) / totalRevenue) * 100) : 0;

  return {
    waste_pct: wastePct,
    waste_value: totalWasteValue,
    stockout_events: totalStockoutEvents,
    missed_revenue: totalMissedRevenue,
    ending_margin_pct: endingMarginPct,
    ending_inventory_value: endingInventoryValue,
    metrics: null,
  };
}

export function simulate(
  initialState: SimState,
  events: SimEvent[],
  resolver: DecisionResolver
): SimulationResult {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const state = structuredClone(initialState);
  const decisions: SimulationResult['decisions'] = [];

  const ctx: EngineContext = {
    initialState: structuredClone(initialState),
    resolver,
    decisions,
  };

  const steps: RunStep[] = [
    {
      seq: 0,
      state_snapshot: structuredClone(state),
      order_state: structuredClone(state.orders),
    },
  ];

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i]!;
    state.current_time = event.at;

    switch (event.type) {
      case 'sales_spike':
        applySalesSpike(state, event, ctx);
        break;
      case 'promotion':
        applyPromotion(state, event, ctx);
        break;
      case 'vendor_delay':
        applyVendorDelay(state, event);
        break;
      case 'damage_report':
        applyDamageReport(state, event);
        break;
      case 'invoice_cost_change':
        applyInvoiceCostChange(state, event, ctx);
        break;
      case 'manager_override':
        applyManagerOverride(state, event);
        break;
    }

    steps.push({
      seq: i + 1,
      state_snapshot: structuredClone(state),
      order_state: structuredClone(state.orders),
    });
  }

  const impact = computeImpact(ctx.initialState, state);

  return { steps, decisions, impact };
}
