import { z } from 'zod';

import {
  DecisionAgentSchema,
  DecisionSourceSchema,
  FailureReasonSchema,
  ForkChangeSchema,
  StartRunBodySchema,
} from '@api/modules/simulation/simulation.schemas';
import type { Decision, OrderState, SimState } from '@api/modules/simulation/simulation.types';

import { RunStatusSchema } from './runs.status';

const JsonObjectSchema = z.record(z.unknown());

const isObject = (val: unknown): val is object => val !== null && typeof val === 'object';
const SimStateSchema = z.custom<SimState>(isObject);
const OrderStateSchema = z.custom<OrderState>(isObject);
const DecisionSchema = z.custom<Decision>(isObject);

export const RunParamsSchema = z.object({
  id: z.string().min(1),
});

export const DayRunParamsSchema = z.object({
  id: z.string().min(1),
});

export const RunDecisionParamsSchema = z.object({
  id: z.string().min(1),
  seq: z.string().regex(/^\d+$/),
});

export const RunStartSchema = z.object({
  id: z.string(),
  day_id: z.string(),
  version_id: z.string(),
  status: RunStatusSchema,
  created_at: z.string(),
});

export const RunDetailSchema = RunStartSchema.extend({
  parent_run_id: z.string().nullable(),
  fork_event_seq: z.number().int().nullable(),
  fork_change: ForkChangeSchema.nullable(),
  label: z.string().nullable(),
  completed_at: z.string().nullable(),
  decisions_total: z.number().int().nonnegative(),
  decisions_failed: z.number().int().nonnegative(),
});

export const RunTimelineItemSchema = z.object({
  seq: z.number().int().nonnegative(),
  state_snapshot: SimStateSchema,
  order_state: z.array(OrderStateSchema),
  created_at: z.string(),
});

export const RunImpactSchema = z.object({
  waste_pct: z.number(),
  waste_value: z.number(),
  stockout_events: z.number().int().nonnegative(),
  missed_revenue: z.number(),
  ending_margin_pct: z.number(),
  ending_inventory_value: z.number(),
  metrics: JsonObjectSchema.nullable(),
});

export const RunDecisionSchema = z.object({
  event_seq: z.number().int().nonnegative(),
  agent: DecisionAgentSchema,
  context_snapshot: SimStateSchema,
  prompt_version: z.string(),
  model_id: z.string(),
  raw_output: z.string(),
  parsed: DecisionSchema,
  reasoning: z.string(),
  source: DecisionSourceSchema,
  valid: z.boolean(),
  latency_ms: z.number().int().nonnegative(),
  failure_reason: FailureReasonSchema.nullable(),
});

export const BranchedRunSchema = RunStartSchema.extend({
  parent_run_id: z.string(),
  fork_event_seq: z.number().int().nonnegative(),
  fork_change: ForkChangeSchema,
});

export const RunListItemSchema = RunStartSchema.extend({
  parent_run_id: z.string().nullable(),
  fork_event_seq: z.number().int().nullable(),
  fork_change: ForkChangeSchema.nullable(),
  label: z.string().nullable(),
  completed_at: z.string().nullable(),
});

export const StartRunEnvelopeSchema = z.object({ data: RunStartSchema });
export const RunDetailEnvelopeSchema = z.object({ data: RunDetailSchema });
export const RunTimelineEnvelopeSchema = z.object({ data: z.array(RunTimelineItemSchema) });
export const RunImpactEnvelopeSchema = z.object({ data: RunImpactSchema });
export const RunDecisionEnvelopeSchema = z.object({ data: RunDecisionSchema });
export const BranchRunEnvelopeSchema = z.object({ data: BranchedRunSchema });
export const RunListEnvelopeSchema = z.object({ data: z.array(RunListItemSchema) });

export { StartRunBodySchema };
