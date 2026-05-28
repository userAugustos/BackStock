export interface CompareRunMeta {
  run_id: string;
  version_id: string;
  parent_run_id: string | null;
  fork_event_seq: number | null;
  label: string | null;
}

export interface CompareStepEntry {
  state_snapshot: Record<string, unknown>;
  order_state: Record<string, unknown>[];
}

export interface CompareDecisionEntry {
  agent: string;
  parsed: unknown;
  source: string;
  reasoning: string;
}

export interface CompareTimelineEntry {
  seq: number;
  steps: Record<string, CompareStepEntry>;
  decisions: Record<string, CompareDecisionEntry | null>;
}

export interface ImpactValues {
  waste_pct: number;
  waste_value: number;
  stockout_events: number;
  missed_revenue: number;
  ending_margin_pct: number;
  ending_inventory_value: number;
}

export interface ImpactDelta extends ImpactValues {
  pair: [string, string];
}

export interface CompareResult {
  day_id: string;
  runs: CompareRunMeta[];
  divergence_seq: number;
  timeline: CompareTimelineEntry[];
  impact: {
    per_run: Record<string, ImpactValues>;
    deltas: ImpactDelta[];
  };
}
