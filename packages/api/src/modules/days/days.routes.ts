import { Elysia } from 'elysia';

import {
  CreateDayBodySchema,
  CreateDayEnvelopeSchema,
  DayDetailResponseSchema,
  DayEventsResponseSchema,
  DayListResponseSchema,
  DayParamsSchema,
} from './days.schemas';
import { createDay, getDay, getDayEvents, listDays } from './days.service';

export const daysRoutes = new Elysia({ name: 'routes.days', prefix: '/days' })
  .get(
    '/',
    async () => {
      const data = await listDays();
      return { data };
    },
    {
      response: { 200: DayListResponseSchema },
      detail: {
        summary: 'List Days',
        description: 'Returns uploaded and seeded simulation days with SKU and event counts.',
        tags: ['days'],
      },
    }
  )
  .post(
    '/',
    async ({ body, set }) => {
      set.status = 201;
      const data = await createDay(body);
      return { data };
    },
    {
      body: CreateDayBodySchema,
      response: { 201: CreateDayEnvelopeSchema },
      detail: {
        summary: 'Create Day',
        description:
          'Uploads a seed state and raw event stream, normalizes accepted events, and returns ignored events when present.',
        tags: ['days'],
      },
    }
  )
  .get(
    '/:id',
    async ({ params }) => {
      const data = await getDay(params.id);
      return { data };
    },
    {
      params: DayParamsSchema,
      response: { 200: DayDetailResponseSchema },
      detail: {
        summary: 'Get Day',
        description:
          'Returns a simulation day, including its seed state and ignored upload report.',
        tags: ['days'],
      },
    }
  )
  .get(
    '/:id/events',
    async ({ params }) => {
      const data = await getDayEvents(params.id);
      return { data };
    },
    {
      params: DayParamsSchema,
      response: { 200: DayEventsResponseSchema },
      detail: {
        summary: 'List Day Events',
        description: 'Returns the normalized event stream stored for a simulation day.',
        tags: ['days'],
      },
    }
  );
