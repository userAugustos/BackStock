import { Elysia } from 'elysia';

import { CompareEnvelopeSchema, CompareQuerySchema } from './compare.schemas';
import { compareRuns } from './compare.service';

export const compareRoutes = new Elysia({ name: 'routes.compare' }).get(
  '/compare',
  async ({ query }) => {
    const runIds = [query.run_a, query.run_b];
    if (query.run_c) runIds.push(query.run_c);
    if (query.run_d) runIds.push(query.run_d);
    const data = await compareRuns(runIds);
    return { data };
  },
  {
    query: CompareQuerySchema,
    response: { 200: CompareEnvelopeSchema },
    detail: {
      summary: 'Compare Runs',
      description:
        'Aligns the timelines of 2 to 4 completed runs of the same day and returns pairwise impact deltas plus the earliest fork point as `divergence_seq`. The HTTP query is capped at 4 to match the UI; the service guard accepts more so future MCP-style callers can compare wider sets.',
      tags: ['compare'],
    },
  }
);
