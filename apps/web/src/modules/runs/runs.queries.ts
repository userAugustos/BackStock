import { queryOptions } from '@tanstack/react-query';
import type { MutationOptions } from '@tanstack/react-query';

import type {
  BranchResult,
  BranchRunBody,
  Run,
  RunDecision,
  RunImpact,
  RunListItem,
  RunStatus,
  RunSummary,
  RunTimelineStep,
} from '@back-stock/api/runs';

import { apiData, ApiResponseError, dayApi, runApi, runDecisionApi } from '@/api';
import { queryKeys } from '@/modules/core/lib/queryKeys';

const ACTIVE_STATUSES: ReadonlySet<RunStatus> = new Set(['queued', 'running']);

export const isRunActive = (status: RunStatus): boolean => ACTIVE_STATUSES.has(status);

export const dayRunsQueryOptions = (dayId: string) =>
  queryOptions({
    queryKey: queryKeys.days.runs(dayId),
    queryFn: () => apiData<RunListItem[]>(() => dayApi(dayId).runs.get()),
    refetchInterval: (query) => {
      const runs = query.state.data;
      if (!runs) return false;
      return runs.some((run) => isRunActive(run.status)) ? 2_000 : false;
    },
  });

export const runQueryOptions = (runId: string) =>
  queryOptions({
    queryKey: queryKeys.runs.detail(runId),
    queryFn: () => apiData<Run>(() => runApi(runId).get()),
    refetchInterval: (query) => (isRunActive(query.state.data?.status ?? 'done') ? 2_000 : false),
  });

export const runTimelineQueryOptions = (runId: string, enabled: boolean) =>
  queryOptions({
    queryKey: queryKeys.runs.timeline(runId),
    queryFn: () => apiData<RunTimelineStep[]>(() => runApi(runId).timeline.get()),
    enabled,
  });

export const runImpactQueryOptions = (runId: string, enabled: boolean) =>
  queryOptions({
    queryKey: queryKeys.runs.impact(runId),
    queryFn: () => apiData<RunImpact>(() => runApi(runId).impact.get()),
    enabled,
  });

/**
 * A decision exists only at decision-point events. The API returns 404
 * (`decision_not_found`) elsewhere, which is an expected absence here — we map
 * it to `null` so callers can render "no decision" without an error state.
 */
export const runDecisionQueryOptions = (runId: string, seq: number, enabled: boolean) =>
  queryOptions({
    queryKey: queryKeys.runs.decision(runId, seq),
    queryFn: async () => {
      try {
        return await apiData<RunDecision>(() => runDecisionApi(runId, seq).get());
      } catch (error) {
        if (error instanceof ApiResponseError && error.code === 'decision_not_found') {
          return null;
        }
        throw error;
      }
    },
    enabled,
  });

export const startRunMutationOptions = (
  dayId: string
): MutationOptions<RunSummary, Error, string> => ({
  mutationFn: (versionId) =>
    apiData<RunSummary>(() => dayApi(dayId).runs.post({ version_id: versionId })),
});

export const branchRunMutationOptions = (
  runId: string
): MutationOptions<BranchResult, Error, BranchRunBody> => ({
  mutationFn: (body) => apiData<BranchResult>(() => runApi(runId).branch.post(body)),
});
