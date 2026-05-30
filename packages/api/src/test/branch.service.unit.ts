import { describe, expect, mock, test } from 'bun:test';

const findDayById = mock(async () => ({ id: 'day-1' }));
const findVersionById = mock(async () => ({ id: 'version-1' }));
const findEventsByDayId = mock(async () => [{ seq: 0 }, { seq: 1 }, { seq: 2 }]);
const publish = mock(async () => {
  throw new Error('broker unavailable');
});
const insertRun = mock(async () => ({
  id: 'branch-run-1',
  dayId: 'day-1',
  versionId: 'version-1',
  parentRunId: 'parent-1',
  forkEventSeq: 1,
  forkChange: JSON.stringify({ type: 'version', version_id: 'version-1' }),
  status: 'queued',
  createdAt: '2026-05-28 18:00:00',
}));
const updateRunStatus = mock(async () => undefined);
const findRunById = mock(async () => ({
  id: 'parent-1',
  dayId: 'day-1',
  versionId: 'version-1',
  status: 'done',
}));

void mock.module('@api/modules/days/days.repository', () => ({
  findDayById,
  findEventsByDayId,
}));
void mock.module('@api/modules/versions/versions.repository', () => ({ findVersionById }));
void mock.module('@api/modules/queue/publisher', () => ({ publish }));
void mock.module('@api/modules/runs/runs.repository', () => ({
  countDecisionsByRunId: mock(async () => ({ total: 0, failed: 0 })),
  findDecisionByRunAndSeq: mock(),
  findImpactByRunId: mock(),
  findRunById,
  findRunStepsByRunId: mock(),
  insertRun,
  updateRunStatus,
}));

describe('branchRun', () => {
  test('marks the created branch run failed when enqueueing fails', async () => {
    const { branchRun } = await import('@api/modules/runs/runs.service');

    try {
      await branchRun('parent-1', 1, { type: 'version', version_id: 'version-1' });
      throw new Error('Expected branchRun to fail');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'run_enqueue_failed',
        status: 500,
      });
    }

    expect(updateRunStatus).toHaveBeenCalledWith('branch-run-1', 'failed');
  });
});
