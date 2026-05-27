import { findDayById, findEventsByDayId } from '@api/modules/days/days.repository';
import { buildInitialState, simulate } from '@api/modules/simulation/simulation.engine';
import { stubDecisionResolver } from '@api/modules/simulation/simulation.stubs';
import { findVersionById } from '@api/modules/versions/versions.repository';
import type { SeedState } from '@api/modules/days/days.schemas';
import type { SimEvent } from '@api/modules/simulation/simulation.types';
import { wrapError } from '@core/errors';
import { LOG_DOMAINS, logger } from '@core/logger';
import { record } from '@core/telemetry';

import {
  findRunById,
  insertDecisions,
  insertImpact,
  insertRunSteps,
  updateRunStatus,
} from './runs.repository';

const workerLogger = logger.child({ domain: LOG_DOMAINS.SIM });

export async function executeRun(runId: string): Promise<void> {
  return record('run.execute', async () => {
    const run = await findRunById(runId);
    if (!run) throw new Error(`Run '${runId}' not found`);

    await updateRunStatus(runId, 'running');

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

      await insertRunSteps(
        result.steps.map((step) => ({
          runId,
          seq: step.seq,
          stateSnapshot: step.state_snapshot,
          orderState: step.order_state,
        }))
      );

      await insertDecisions(
        result.decisions.map((d) => ({
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
        }))
      );

      await insertImpact({ runId, impact: result.impact });

      await updateRunStatus(runId, 'done', new Date().toISOString());

      workerLogger.info('Run completed', { run_id: runId });
    } catch (error) {
      workerLogger.error('Run failed', { run_id: runId, error });
      await updateRunStatus(runId, 'failed');
      throw wrapError(error, 'run_execution_failed', `Run '${runId}' failed`);
    }
  }) as Promise<void>;
}
