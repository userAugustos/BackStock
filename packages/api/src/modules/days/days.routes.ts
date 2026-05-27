import { Elysia } from 'elysia';

import { CreateDayBodySchema } from './days.schemas';
import { createDay, getDay, getDayEvents, listDays } from './days.service';

export const daysRoutes = new Elysia({ name: 'routes.days', prefix: '/days' })
  .get('/', async () => {
    const data = await listDays();
    return { data };
  })
  .post(
    '/',
    async ({ body, set }) => {
      set.status = 201;
      const data = await createDay(body);
      return { data };
    },
    { body: CreateDayBodySchema }
  )
  .get('/:id', async ({ params }) => {
    const data = await getDay(params.id);
    return { data };
  })
  .get('/:id/events', async ({ params }) => {
    const data = await getDayEvents(params.id);
    return { data };
  });
