import { edenTreaty } from '@elysiajs/eden';

import type { BackStockApi } from '@back-stock/api/client';

const _client = edenTreaty<BackStockApi>('http://localhost:3000');

// Forces actual type resolution so tree-shaking can't hide a broken bridge.
// If `BackStockApi` doesn't resolve, web typecheck fails here loudly and locally.
export type _HealthzReturn = Awaited<ReturnType<typeof _client.healthz.get>>;
