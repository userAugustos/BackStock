import { z } from 'zod';

/**
 * The full set of values the runtime can persist into `runs.status`. Single source
 * of truth — the Zod route schema, the TS union, and the repository's status producer
 * all derive from this tuple, so adding a state in one place fails typecheck everywhere
 * the others haven't caught up.
 */
export const RUN_STATUSES = ['queued', 'running', 'done', 'done_degraded', 'failed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export const RunStatusSchema = z.enum(RUN_STATUSES);

const COMPLETED_RUN_STATUSES: ReadonlySet<RunStatus> = new Set(['done', 'done_degraded']);

export function isCompletedRunStatus(status: string): status is 'done' | 'done_degraded' {
  return COMPLETED_RUN_STATUSES.has(status as RunStatus);
}
