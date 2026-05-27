import { edenTreaty } from '@elysiajs/eden';

import type { BackStockApi } from '@api/app';
import { config } from '@core/env';

export const createApi = (): ReturnType<typeof edenTreaty<BackStockApi>> =>
  edenTreaty<BackStockApi>(config.app.apiUrl);
