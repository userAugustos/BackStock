import { findDayById, findEventsByDayId } from '@api/modules/days/days.repository';
import { buildInitialState, simulate } from '@api/modules/simulation/simulation.engine';
import { stubDecisionResolver } from '@api/modules/simulation/simulation.stubs';
import { findVersionById } from '@api/modules/versions/versions.repository';
import type { SeedState } from '@api/modules/days/days.schemas';
import type { SimEvent } from '@api/modules/simulation/simulation.types';
import { wrapError } from '@core/errors';
import { LOG_DOMAINS, logger } from '@core/logger';
import { record } from '@core/telemetry';

import { completeRunOnce, findRunById, updateRunStatus } from './runs.repository';

const workerLogger = logger.child({ domain: LOG_DOMAINS.SIM });
const RUN_WORKER_SUBSCRIBER_ID = 'runs.worker';

/**
 * Executes a queued run. Redelivered queue messages are idempotent because only
 * one transaction can record the processed message and persist the run result.
 */
export async function executeRun(runId: string): Promise<void> {
  return record('run.execute', async () => {
    const run = await findRunById(runId);
    if (!run) {
      workerLogger.info('Skipping run execution', {
        run_id: runId,
        status: 'missing',
      });
      return;
    }

    if (run.status !== 'queued') {
      workerLogger.info('Skipping run execution', { run_id: runId, status: run.status });
      return;
    }

    try {
      const day = await findDayById(run.dayId);
      if (!day) throw new Error(`Day '${run.dayId}' not found for run '${runId}'`);

      const version = await findVersionById(run.versionId);
      if (!version) throw new Error(`Version '${run.versionId}' not found for run '${runId}'`);

      const seedState: SeedState = JSON.parse(day.seedState);
      const eventRows = await findEventsByDayId(run.dayId);
      const events: SimEvent[] = eventRows.map((e) => ({
        seq: e.seq,
        at: e.occurredAt,
        type: e.type,
        payload: JSON.parse(e.payload),
      }));

      const initialState = buildInitialState(seedState);
      const result = simulate(initialState, events, stubDecisionResolver);

      const completed = completeRunOnce({
        runId,
        subscriberId: RUN_WORKER_SUBSCRIBER_ID,
        messageId: runId,
        steps: result.steps.map((step) => ({
          runId,
          seq: step.seq,
          stateSnapshot: step.state_snapshot,
          orderState: step.order_state,
        })),
        decisions: result.decisions.map((d) => ({
          runId,
          eventSeq: d.event_seq,
          agent: d.decision.agent,
          contextSnapshot: d.context_snapshot,
          promptVersion:
            d.decision.agent === 'pricing'
              ? version.pricingPromptVersion
              : version.inventoryPromptVersion,
          modelId: version.modelId,
          rawOutput: JSON.stringify(d.decision),
          parsed: d.decision,
          reasoning: d.decision.summary,
          source: 'stub',
          valid: true,
          latencyMs: 0,
        })),
        impact: result.impact,
        completedAt: new Date().toISOString(),
      });

      if (!completed) {
        workerLogger.info('Skipping duplicate run message', { run_id: runId });
        return;
      }

      workerLogger.info('Run completed', { run_id: runId });
    } catch (error) {
      workerLogger.error('Run failed', { run_id: runId, error });
      await updateRunStatus(runId, 'failed');
      throw wrapError(error, 'run_execution_failed', `Run '${runId}' failed`);
    }
  }) as Promise<void>;
}
