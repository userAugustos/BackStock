import { z } from 'zod';

export const StartRunBodySchema = z.object({
  version_id: z.string().min(1),
});

export type StartRunBody = z.infer<typeof StartRunBodySchema>;
