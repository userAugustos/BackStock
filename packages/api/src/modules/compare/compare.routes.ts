import { Elysia } from 'elysia';
import { z } from 'zod';

import { compareRuns } from './compare.service';

const CompareQuerySchema = z.object({
  run_a: z.string().min(1),
  run_b: z.string().min(1),
  run_c: z.string().min(1).optional(),
});

export const compareRoutes = new Elysia({ name: 'routes.compare' }).get(
  '/compare',
  async ({ query }) => {
    const runIds = [query.run_a, query.run_b];
    if (query.run_c) runIds.push(query.run_c);
    const data = await compareRuns(runIds);
    return { data };
  },
  { query: CompareQuerySchema }
);
