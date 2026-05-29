import { describe, expect, mock, test } from 'bun:test';

const findDayById = mock(async () => ({ id: 'day-1' }));
const findVersionById = mock(async () => ({ id: 'version-1' }));
const publish = mock(async () => {
  throw new Error('broker unavailable');
});
const insertRun = mock(async () => ({
  id: 'run-1',
  dayId: 'day-1',
  versionId: 'version-1',
  status: 'queued',
  createdAt: '2026-05-28 18:00:00',
}));
const updateRunStatus = mock(async () => undefined);

void mock.module('@api/modules/days/days.repository', () => ({ findDayById }));
void mock.module('@api/modules/versions/versions.repository', () => ({ findVersionById }));
void mock.module('@api/modules/queue/publisher', () => ({ publish }));
void mock.module('@api/modules/runs/runs.repository', () => ({
  countDecisionsByRunId: mock(async () => ({ total: 0, failed: 0 })),
  findDecisionByRunAndSeq: mock(),
  findImpactByRunId: mock(),
  findRunById: mock(),
  findRunStepsByRunId: mock(),
  insertRun,
  updateRunStatus,
}));

describe('runs service', () => {
  test('marks a created run failed when enqueueing fails', async () => {
    const { startRun } = await import('@api/modules/runs/runs.service');

    try {
      await startRun('day-1', 'version-1');
      throw new Error('Expected startRun to fail');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'run_enqueue_failed',
        status: 500,
      });
    }

    expect(updateRunStatus).toHaveBeenCalledWith('run-1', 'failed');
  });
});
