import { Elysia } from 'elysia';

import { CompareEnvelopeSchema, CompareQuerySchema } from './compare.schemas';
import { compareRuns } from './compare.service';

export const compareRoutes = new Elysia({ name: 'routes.compare' }).get(
  '/compare',
  async ({ query }) => {
    const runIds = [query.run_a, query.run_b];
    if (query.run_c) runIds.push(query.run_c);
    const data = await compareRuns(runIds);
    return { data };
  },
  {
    query: CompareQuerySchema,
    response: { 200: CompareEnvelopeSchema },
    detail: {
      summary: 'Compare Runs',
      description:
        'Aligns the timelines of 2 or 3 completed runs of the same day and returns pairwise impact deltas plus the earliest fork point as `divergence_seq`.',
      tags: ['compare'],
    },
  }
);
