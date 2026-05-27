import { edenTreaty } from '@elysiajs/eden';

import type { StorePilotApi } from '@api/app';
import { config } from '@core/env';

export const createApi = (): ReturnType<typeof edenTreaty<StorePilotApi>> =>
  edenTreaty<StorePilotApi>(config.app.apiUrl);
