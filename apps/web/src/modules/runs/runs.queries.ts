import { queryOptions } from '@tanstack/react-query';
import type { MutationOptions } from '@tanstack/react-query';

import type { Run, RunStatus, RunSummary } from '@back-stock/api/runs';

import { apiData, dayApi } from '@/api';
import { queryKeys } from '@/modules/core/lib/queryKeys';

const ACTIVE_STATUSES: ReadonlySet<RunStatus> = new Set(['queued', 'running']);

export const isRunActive = (status: RunStatus): boolean => ACTIVE_STATUSES.has(status);

export const dayRunsQueryOptions = (dayId: string) =>
  queryOptions({
    queryKey: queryKeys.days.runs(dayId),
    queryFn: () => apiData<Run[]>(() => dayApi(dayId).runs.get()),
    refetchInterval: (query) => {
      const runs = query.state.data;
      if (!runs) return false;
      return runs.some((run) => isRunActive(run.status)) ? 2_000 : false;
    },
  });

export const startRunMutationOptions = (
  dayId: string
): MutationOptions<RunSummary, Error, string> => ({
  mutationFn: (versionId) =>
    apiData<RunSummary>(() => dayApi(dayId).runs.post({ version_id: versionId })),
});
