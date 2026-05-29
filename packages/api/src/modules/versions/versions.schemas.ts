import { z } from 'zod';

export const CreateVersionBodySchema = z.object({
  label: z.string().min(1).max(200),
  inventory_prompt_version: z.string().min(1),
  pricing_prompt_version: z.string().min(1),
  model_id: z.string().min(1),
  policy: z.record(z.unknown()).nullable().optional(),
});

export const VersionParamsSchema = z.object({
  id: z.string().min(1),
});

export const VersionSchema = z.object({
  id: z.string(),
  label: z.string(),
  inventory_prompt_version: z.string(),
  pricing_prompt_version: z.string(),
  model_id: z.string(),
  policy: z.record(z.unknown()).nullable(),
  created_at: z.string(),
});

export const VersionListResponseSchema = z.object({ data: z.array(VersionSchema) });
export const VersionResponseSchema = z.object({ data: VersionSchema });

export type CreateVersionBody = z.infer<typeof CreateVersionBodySchema>;
