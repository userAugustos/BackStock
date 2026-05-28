import { z } from 'zod';

export const StartRunBodySchema = z.object({
  version_id: z.string().min(1),
});

export type StartRunBody = z.infer<typeof StartRunBodySchema>;

const DecisionOverrideSchema = z.object({
  type: z.literal('decision_override'),
  decision: z.discriminatedUnion('agent', [
    z.object({
      agent: z.literal('inventory'),
      sku_id: z.string().min(1),
      order_cases: z.number().int().min(0),
      summary: z.string().min(1),
    }),
    z.object({
      agent: z.literal('pricing'),
      sku_id: z.string().min(1),
      new_price: z.number().positive(),
      summary: z.string().min(1),
    }),
  ]),
});

const VersionChangeSchema = z.object({
  type: z.literal('version'),
  version_id: z.string().min(1),
});

export const BranchRunBodySchema = z.object({
  at_event_seq: z.number().int().min(0),
  change: z.discriminatedUnion('type', [DecisionOverrideSchema, VersionChangeSchema]),
});

export type BranchRunBody = z.infer<typeof BranchRunBodySchema>;
