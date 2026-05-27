import { Elysia } from 'elysia';

import { CreateVersionBodySchema } from './versions.schemas';
import { createVersion, getVersion, listVersions } from './versions.service';

export const versionsRoutes = new Elysia({ name: 'routes.versions', prefix: '/versions' })
  .get('/', async () => {
    const data = await listVersions();
    return { data };
  })
  .post(
    '/',
    async ({ body, set }) => {
      set.status = 201;
      const data = await createVersion(body);
      return { data };
    },
    { body: CreateVersionBodySchema }
  )
  .get('/:id', async ({ params }) => {
    const data = await getVersion(params.id);
    return { data };
  });
