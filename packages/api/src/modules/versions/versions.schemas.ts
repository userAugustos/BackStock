import { z } from 'zod';

export const CreateVersionBodySchema = z.object({
  label: z.string().min(1).max(200),
  inventory_prompt_version: z.string().min(1),
  pricing_prompt_version: z.string().min(1),
  model_id: z.string().min(1),
  policy: z.record(z.unknown()).nullable().optional(),
});

export type CreateVersionBody = z.infer<typeof CreateVersionBodySchema>;
