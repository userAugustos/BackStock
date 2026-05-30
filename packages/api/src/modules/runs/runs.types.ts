import type {
  Decision,
  DecisionAgent,
  ForkChange,
  OrderState,
  SimState,
} from '@api/modules/simulation/simulation.types';

export type RunStatus = 'queued' | 'running' | 'done' | 'failed';

export interface RunListItem {
  id: string;
  day_id: string;
  version_id: string;
  parent_run_id: string | null;
  fork_event_seq: number | null;
  fork_change: ForkChange | null;
  status: RunStatus;
  label: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Run extends RunListItem {
  decisions_total: number;
  decisions_failed: number;
}

export interface RunSummary {
  id: string;
  day_id: string;
  version_id: string;
  status: RunStatus;
  created_at: string;
}

export interface BranchResult {
  id: string;
  day_id: string;
  version_id: string;
  parent_run_id: string | null;
  fork_event_seq: number | null;
  fork_change: ForkChange | null;
  status: RunStatus;
  created_at: string;
}

export interface RunTimelineStep {
  seq: number;
  state_snapshot: SimState;
  order_state: OrderState[];
  created_at: string;
}

export interface RunImpact {
  waste_pct: number;
  waste_value: number;
  stockout_events: number;
  missed_revenue: number;
  ending_margin_pct: number;
  ending_inventory_value: number;
  metrics: Record<string, unknown> | null;
}

export interface RunDecision {
  event_seq: number;
  agent: DecisionAgent;
  context_snapshot: SimState;
  prompt_version: string;
  model_id: string;
  raw_output: string;
  parsed: Decision;
  reasoning: string;
  source: 'stub' | 'llm' | 'override' | 'reused' | 'failure';
  valid: boolean;
  latency_ms: number;
  failure_reason: string | null;
}
