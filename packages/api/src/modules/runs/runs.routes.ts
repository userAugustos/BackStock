import { Elysia } from 'elysia';

import {
  DayRunParamsSchema,
  RunDecisionEnvelopeSchema,
  RunDecisionParamsSchema,
  RunDetailEnvelopeSchema,
  RunImpactEnvelopeSchema,
  RunParamsSchema,
  RunTimelineEnvelopeSchema,
  StartRunBodySchema,
  StartRunEnvelopeSchema,
} from './runs.schemas';
import { getRun, getRunDecision, getRunImpact, getRunTimeline, startRun } from './runs.service';

export const runsRoutes = new Elysia({ name: 'routes.runs' })
  .post(
    '/days/:id/runs',
    async ({ params, body, set }) => {
      set.status = 201;
      const data = await startRun(params.id, body.version_id);
      return { data };
    },
    {
      params: DayRunParamsSchema,
      body: StartRunBodySchema,
      response: { 201: StartRunEnvelopeSchema },
      detail: {
        summary: 'Start Run',
        description:
          'Creates a queued simulation run for a day and version, then publishes the run request to RabbitMQ.',
        tags: ['runs'],
      },
    }
  )
  .get(
    '/runs/:id',
    async ({ params }) => {
      const data = await getRun(params.id);
      return { data };
    },
    {
      params: RunParamsSchema,
      response: { 200: RunDetailEnvelopeSchema },
      detail: {
        summary: 'Get Run',
        description: 'Returns run metadata, status, branch metadata, and completion timestamp.',
        tags: ['runs'],
      },
    }
  )
  .get(
    '/runs/:id/timeline',
    async ({ params }) => {
      const data = await getRunTimeline(params.id);
      return { data };
    },
    {
      params: RunParamsSchema,
      response: { 200: RunTimelineEnvelopeSchema },
      detail: {
        summary: 'Get Run Timeline',
        description: 'Returns persisted simulation state snapshots for a completed run.',
        tags: ['runs'],
      },
    }
  )
  .get(
    '/runs/:id/impact',
    async ({ params }) => {
      const data = await getRunImpact(params.id);
      return { data };
    },
    {
      params: RunParamsSchema,
      response: { 200: RunImpactEnvelopeSchema },
      detail: {
        summary: 'Get Run Impact',
        description:
          'Returns waste, revenue, margin, stockout, and ending inventory metrics for a completed run.',
        tags: ['runs'],
      },
    }
  )
  .get(
    '/runs/:id/decisions/:seq',
    async ({ params }) => {
      const seq = parseInt(params.seq, 10);
      const data = await getRunDecision(params.id, seq);
      return { data };
    },
    {
      params: RunDecisionParamsSchema,
      response: { 200: RunDecisionEnvelopeSchema },
      detail: {
        summary: 'Get Run Decision',
        description:
          'Returns the agent decision, context snapshot, model metadata, and parsed output for one event.',
        tags: ['runs'],
      },
    }
  );
