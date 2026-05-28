import { Elysia } from 'elysia';

import { BranchRunBodySchema } from '@api/modules/simulation/simulation.schemas';

import {
  BranchRunEnvelopeSchema,
  DayRunParamsSchema,
  RunDecisionEnvelopeSchema,
  RunDecisionParamsSchema,
  RunDetailEnvelopeSchema,
  RunImpactEnvelopeSchema,
  RunListEnvelopeSchema,
  RunParamsSchema,
  RunTimelineEnvelopeSchema,
  StartRunBodySchema,
  StartRunEnvelopeSchema,
} from './runs.schemas';
import {
  branchRun,
  getRun,
  getRunDecision,
  getRunImpact,
  getRunTimeline,
  listRunsForDay,
  startRun,
} from './runs.service';

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
    '/days/:id/runs',
    async ({ params }) => {
      const data = await listRunsForDay(params.id);
      return { data };
    },
    {
      params: DayRunParamsSchema,
      response: { 200: RunListEnvelopeSchema },
      detail: {
        summary: 'List Runs For Day',
        description:
          'Returns every run (root + forked branches) created for a given day, ordered by creation time.',
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
  )
  .post(
    '/runs/:id/branch',
    async ({ params, body, set }) => {
      set.status = 201;
      const data = await branchRun(params.id, body.at_event_seq, body.change);
      return { data };
    },
    {
      params: RunParamsSchema,
      body: BranchRunBodySchema,
      response: { 201: BranchRunEnvelopeSchema },
      detail: {
        summary: 'Branch Run',
        description:
          'Forks a completed parent run at an event seq, replaying pre-fork decisions and applying the fork change (decision override or version swap).',
        tags: ['runs'],
      },
    }
  );
