import type { CompareDecisionEntry, CompareStepEntry, ImpactValues } from '@back-stock/api/compare';
import type { Decision, SimState } from '@back-stock/api/simulation';

import { formatCurrency, formatNumber, formatPercentPoints } from '@/modules/core/lib/format';

/**
 * Whether a smaller or larger value is the better outcome for a metric.
 * `neutral` metrics (e.g. ending inventory) are informational — no win/loss color.
 */
export type BetterDirection = 'lower' | 'higher' | 'neutral';

export interface MetricDef {
  key: keyof ImpactValues;
  label: string;
  better: BetterDirection;
  format: (value: number) => string;
  testid: string;
}

export const COMPARE_METRICS: MetricDef[] = [
  {
    key: 'waste_pct',
    label: 'Waste %',
    better: 'lower',
    format: formatPercentPoints,
    testid: 'waste_pct',
  },
  {
    key: 'waste_value',
    label: 'Waste value',
    better: 'lower',
    format: formatCurrency,
    testid: 'waste_value',
  },
  {
    key: 'stockout_events',
    label: 'Stockouts',
    better: 'lower',
    format: formatNumber,
    testid: 'stockout_events',
  },
  {
    key: 'missed_revenue',
    label: 'Missed revenue',
    better: 'lower',
    format: formatCurrency,
    testid: 'missed_revenue',
  },
  {
    key: 'ending_margin_pct',
    label: 'Ending margin',
    better: 'higher',
    format: formatPercentPoints,
    testid: 'ending_margin_pct',
  },
  {
    key: 'ending_inventory_value',
    label: 'Ending inventory',
    better: 'neutral',
    format: formatCurrency,
    testid: 'ending_inventory_value',
  },
];

/** Metrics surfaced in the comparison bar chart — the headline outcome deltas. */
export const CHART_METRIC_KEYS = [
  'waste_pct',
  'stockout_events',
  'ending_margin_pct',
] as const satisfies readonly (keyof ImpactValues)[];

export type DeltaTone = 'good' | 'bad' | 'neutral';

/**
 * Classify a pairwise delta (b − a) against the metric's better-direction.
 * A near-zero delta is neutral so identical runs don't get colored as a win.
 */
export function deltaTone(value: number, better: BetterDirection): DeltaTone {
  if (better === 'neutral' || value === 0) return 'neutral';
  if (better === 'lower') return value < 0 ? 'good' : 'bad';
  return value > 0 ? 'good' : 'bad';
}

/** The SDK types compare step/decision payloads as `unknown`; narrow at this boundary. */
export function readState(entry: CompareStepEntry | undefined): SimState | null {
  return entry ? (entry.state_snapshot as unknown as SimState) : null;
}

export function readDecision(entry: CompareDecisionEntry | null | undefined): Decision | null {
  return entry ? (entry.parsed as Decision) : null;
}

/** Stable identity for a parsed decision so we can detect when runs decided differently. */
export function decisionFingerprint(decision: Decision | null): string {
  if (!decision) return '∅';
  if (decision.agent === 'inventory') {
    return `inv:${decision.sku_id}:${decision.order_cases}`;
  }
  return `price:${decision.sku_id}:${decision.new_price}`;
}

export function describeDecision(decision: Decision | null): string {
  if (!decision) return 'no decision';
  if (decision.agent === 'inventory') {
    return `${decision.sku_id} → ${formatNumber(decision.order_cases)} cases`;
  }
  return `${decision.sku_id} → ${formatCurrency(decision.new_price)}`;
}
