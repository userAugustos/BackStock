import { STORE_CLOSE_HOUR, STORE_OPEN_HOUR } from '@back-stock/api/simulation';
import type { DayEvent } from '@back-stock/api/days';
import type { RunTimelineStep } from '@back-stock/api/runs';
import type { SimState, SkuState } from '@back-stock/api/simulation';

export interface StoreTotals {
  inventoryUnits: number;
  revenue: number;
  cogs: number;
  /** Ratio 0..1; 0 when there is no revenue yet. */
  marginRatio: number;
  wasteUnits: number;
  stockoutEvents: number;
  missedRevenue: number;
}

export interface StepSeriesPoint {
  step: number;
  inventoryUnits: number;
  marginPct: number;
  revenue: number;
}

export interface EventMarker {
  seq: number;
  type: string;
  at: string;
  /** Fraction 0..1 across the store day used for horizontal placement. */
  position: number;
  /** Timeline step the playhead lands on once this event has been applied. */
  stepIndex: number;
}

/**
 * Event types that drive an agent decision. The engine only resolves a decision
 * for these (sales_spike/promotion → inventory; invoice_cost_change → pricing),
 * so we gate the decision lookup on them and avoid spurious 404 round-trips.
 */
const DECISION_POINT_TYPES: ReadonlySet<string> = new Set([
  'sales_spike',
  'promotion',
  'invoice_cost_change',
]);

/** Event seqs that may carry an agent decision, keyed for O(1) lookup. */
export function buildDecisionPointSeqs(events: DayEvent[]): Set<number> {
  const seqs = new Set<number>();
  for (const event of events) {
    if (DECISION_POINT_TYPES.has(event.type)) seqs.add(event.seq);
  }
  return seqs;
}

const skuList = (state: SimState): SkuState[] => Object.values(state.skus);

export function computeStoreTotals(state: SimState): StoreTotals {
  let inventoryUnits = 0;
  let revenue = 0;
  let cogs = 0;
  let wasteUnits = 0;
  let stockoutEvents = 0;
  let missedRevenue = 0;

  for (const sku of skuList(state)) {
    inventoryUnits += sku.on_hand;
    revenue += sku.revenue;
    cogs += sku.cost_of_goods;
    wasteUnits += sku.units_wasted;
    stockoutEvents += sku.stockout_events;
    missedRevenue += sku.missed_revenue;
  }

  return {
    inventoryUnits,
    revenue,
    cogs,
    marginRatio: revenue > 0 ? (revenue - cogs) / revenue : 0,
    wasteUnits,
    stockoutEvents,
    missedRevenue,
  };
}

/** Per-SKU blended margin ratio (price vs unit_cost) for the catalog rows. */
export function skuMarginRatio(sku: SkuState): number {
  return sku.price > 0 ? (sku.price - sku.unit_cost) / sku.price : 0;
}

export function buildStepSeries(steps: RunTimelineStep[]): StepSeriesPoint[] {
  return steps.map((step) => {
    const totals = computeStoreTotals(step.state_snapshot);
    return {
      step: step.seq,
      inventoryUnits: totals.inventoryUnits,
      marginPct: totals.marginRatio * 100,
      revenue: totals.revenue,
    };
  });
}

/** Parse a "HH:MM" store-clock string into fractional hours; null if invalid. */
function parseClock(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours + minutes / 60;
}

/**
 * Position a store-clock time along the 08:00 → 22:00 axis as a 0..1 fraction,
 * clamped so off-hours events still render at the rail edges.
 */
export function clockToPosition(time: string): number {
  const hours = parseClock(time);
  if (hours === null) return 0;
  const span = STORE_CLOSE_HOUR - STORE_OPEN_HOUR;
  const raw = (hours - STORE_OPEN_HOUR) / span;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Map day events to timeline markers. Event `seq` is applied to produce the
 * NEXT step, so the playhead step for event `e` is its array index + 1.
 */
export function buildEventMarkers(events: DayEvent[]): EventMarker[] {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  return sorted.map((event, idx) => ({
    seq: event.seq,
    type: event.type,
    at: event.at,
    position: clockToPosition(event.at),
    stepIndex: idx + 1,
  }));
}

/** Fraction 0..1 of the playhead across the step range (0..lastStep). */
export function stepToPosition(index: number, stepCount: number): number {
  if (stepCount <= 1) return 0;
  return index / (stepCount - 1);
}

export const HOUR_TICKS: number[] = Array.from(
  { length: STORE_CLOSE_HOUR - STORE_OPEN_HOUR + 1 },
  (_, i) => STORE_OPEN_HOUR + i
);
