const COMPLETED_RUN_STATUSES = new Set(['done', 'done_degraded']);

export function isCompletedRunStatus(status: string): boolean {
  return COMPLETED_RUN_STATUSES.has(status);
}
