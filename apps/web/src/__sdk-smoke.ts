import { edenTreaty } from '@elysiajs/eden';

import type { StorePilotApi } from '@store-pilot/api/client';

const _client = edenTreaty<StorePilotApi>('http://localhost:3000');

// Forces actual type resolution so tree-shaking can't hide a broken bridge.
// If `StorePilotApi` doesn't resolve, web typecheck fails here loudly and locally.
export type _HealthzReturn = Awaited<ReturnType<typeof _client.healthz.get>>;
