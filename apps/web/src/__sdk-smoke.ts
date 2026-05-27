import { edenTreaty } from '@elysiajs/eden';

import type { BackStockApi } from '@back-stock/api/client';
import type { CreateDayBodySchema } from '@back-stock/api/days';
import type { StartRunBodySchema } from '@back-stock/api/runs';
import type { CreateVersionBodySchema } from '@back-stock/api/versions';

const _client = edenTreaty<BackStockApi>('http://localhost:3000');

// Forces actual type resolution so tree-shaking can't hide a broken bridge.
// If `BackStockApi` doesn't resolve, web typecheck fails here loudly and locally.
export type _HealthzReturn = Awaited<ReturnType<typeof _client.healthz.get>>;
export type _DaysSchemaCheck = typeof CreateDayBodySchema;
export type _RunsSchemaCheck = typeof StartRunBodySchema;
export type _VersionsSchemaCheck = typeof CreateVersionBodySchema;
