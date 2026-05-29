import { Elysia } from 'elysia';

import {
  CreateVersionBodySchema,
  VersionListResponseSchema,
  VersionParamsSchema,
  VersionResponseSchema,
} from './versions.schemas';
import { createVersion, getVersion, listVersions } from './versions.service';

export const versionsRoutes = new Elysia({ name: 'routes.versions', prefix: '/versions' })
  .get(
    '/',
    async () => {
      const data = await listVersions();
      return { data };
    },
    {
      response: { 200: VersionListResponseSchema },
      detail: {
        summary: 'List Versions',
        description: 'Returns available agent version bundles for simulation runs.',
        tags: ['versions'],
      },
    }
  )
  .post(
    '/',
    async ({ body, set }) => {
      set.status = 201;
      const data = await createVersion(body);
      return { data };
    },
    {
      body: CreateVersionBodySchema,
      response: { 201: VersionResponseSchema },
      detail: {
        summary: 'Create Version',
        description: 'Creates an agent version bundle from prompt versions, model id, and policy.',
        tags: ['versions'],
      },
    }
  )
  .get(
    '/:id',
    async ({ params }) => {
      const data = await getVersion(params.id);
      return { data };
    },
    {
      params: VersionParamsSchema,
      response: { 200: VersionResponseSchema },
      detail: {
        summary: 'Get Version',
        description: 'Returns one agent version bundle by id.',
        tags: ['versions'],
      },
    }
  );
