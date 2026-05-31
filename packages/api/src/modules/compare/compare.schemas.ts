import { z } from 'zod';

const JsonObjectSchema = z.record(z.unknown());

const CompareRunMetaSchema = z.object({
  run_id: z.string(),
  version_id: z.string(),
  parent_run_id: z.string().nullable(),
  fork_event_seq: z.number().int().nullable(),
  label: z.string().nullable(),
});

const CompareStepEntrySchema = z.object({
  state_snapshot: JsonObjectSchema,
  order_state: z.array(JsonObjectSchema),
});

const CompareDecisionEntrySchema = z.object({
  agent: z.string(),
  parsed: z.unknown(),
  source: z.string(),
  reasoning: z.string(),
});

const CompareTimelineEntrySchema = z.object({
  seq: z.number().int().nonnegative(),
  steps: z.record(CompareStepEntrySchema),
  decisions: z.record(CompareDecisionEntrySchema.nullable()),
});

const ImpactValuesSchema = z.object({
  waste_pct: z.number(),
  waste_value: z.number(),
  stockout_events: z.number().int(),
  missed_revenue: z.number(),
  ending_margin_pct: z.number(),
  ending_inventory_value: z.number(),
});

const ImpactDeltaSchema = ImpactValuesSchema.extend({
  pair: z.tuple([z.string(), z.string()]),
});

export const CompareResultSchema = z.object({
  day_id: z.string(),
  runs: z.array(CompareRunMetaSchema),
  divergence_seq: z.number().int().nonnegative(),
  timeline: z.array(CompareTimelineEntrySchema),
  impact: z.object({
    per_run: z.record(ImpactValuesSchema),
    deltas: z.array(ImpactDeltaSchema),
  }),
});

export const CompareQuerySchema = z.object({
  run_a: z.string().min(1),
  run_b: z.string().min(1),
  run_c: z.string().min(1).optional(),
  run_d: z.string().min(1).optional(),
});

export const CompareEnvelopeSchema = z.object({ data: CompareResultSchema });
