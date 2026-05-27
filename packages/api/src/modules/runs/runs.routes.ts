import { Elysia } from 'elysia';

import { StartRunBodySchema } from '@api/modules/simulation/simulation.schemas';

import { getRun, getRunDecision, getRunImpact, getRunTimeline, startRun } from './runs.service';

export const runsRoutes = new Elysia({ name: 'routes.runs' })
  .post(
    '/days/:id/runs',
    async ({ params, body, set }) => {
      set.status = 201;
      const data = await startRun(params.id, body.version_id);
      return { data };
    },
    { body: StartRunBodySchema }
  )
  .get('/runs/:id', async ({ params }) => {
    const data = await getRun(params.id);
    return { data };
  })
  .get('/runs/:id/timeline', async ({ params }) => {
    const data = await getRunTimeline(params.id);
    return { data };
  })
  .get('/runs/:id/impact', async ({ params }) => {
    const data = await getRunImpact(params.id);
    return { data };
  })
  .get('/runs/:id/decisions/:seq', async ({ params }) => {
    const seq = parseInt(params.seq, 10);
    const data = await getRunDecision(params.id, seq);
    return { data };
  });
