import { createLlmClient } from '@api/modules/agents/agents.llm-client';
import { createLlmDecisionResolver } from '@api/modules/agents/agents.resolver';
import { findDayById, findEventsByDayId } from '@api/modules/days/days.repository';
import { buildInitialState, simulate } from '@api/modules/simulation/simulation.engine';
import { stubDecisionResolver } from '@api/modules/simulation/simulation.stubs';
import { findVersionById } from '@api/modules/versions/versions.repository';
import type { SeedState } from '@api/modules/days/days.schemas';
import type {
  DecisionResolver,
  ForkChange,
  ResolvedDecision,
  SimEvent,
} from '@api/modules/simulation/simulation.types';
import { config } from '@core/env';
import { wrapError } from '@core/errors';
import { LOG_DOMAINS, logger } from '@core/logger';
import { record } from '@core/telemetry';

import {
  completeRunOnce,
  findDecisionsByRunId,
  findRunById,
  updateRunStatus,
} from './runs.repository';
import { createForkingResolver } from './runs.resolver-factory';

const workerLogger = logger.child({ domain: LOG_DOMAINS.SIM });
const RUN_WORKER_SUBSCRIBER_ID = 'runs.worker';

// Model ids that bypass the LLM and use the deterministic stub resolver (tests / no-Modal dev).
const STUB_MODEL_IDS = new Set(['stub', 'stub-model']);

function isStubModel(modelId: string): boolean {
  return STUB_MODEL_IDS.has(modelId);
}

/**
 * Selects a run's decision resolver from its version's model id: stub ids use the
 * deterministic stub resolver; any other id wires a real Modal LLM client + resolver.
 */
function buildResolver(
  modelId: string,
  catalogSkuIds: string[],
  inventoryPromptVersion: string,
  pricingPromptVersion: string
): DecisionResolver {
  if (isStubModel(modelId)) {
    return stubDecisionResolver;
  }

  const client = createLlmClient({
    url: config.llm.url,
    token: config.llm.token,
    proxyKey: config.llm.proxyKey,
    proxySecret: config.llm.proxySecret,
    timeoutMs: config.llm.timeoutMs,
  });

  const resolver = createLlmDecisionResolver({
    client,
    catalogSkuIds,
    modelId,
    inventoryPromptVersion,
    pricingPromptVersion,
  });

  return resolver;
}

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

      const catalogSkuIds = seedState.skus.map((s) => s.id);
      const baseResolver = buildResolver(
        version.modelId,
        catalogSkuIds,
        version.inventoryPromptVersion,
        version.pricingPromptVersion
      );

      let resolver: DecisionResolver = baseResolver;

      if (run.parentRunId && run.forkEventSeq !== null) {
        const forkChange: ForkChange = run.forkChange
          ? JSON.parse(run.forkChange)
          : { type: 'version', version_id: run.versionId };

        const parentDecisionRows = await findDecisionsByRunId(run.parentRunId);
        const parentDecisions = new Map<number, ResolvedDecision>();
        for (const row of parentDecisionRows) {
          parentDecisions.set(row.eventSeq, {
            decision: JSON.parse(row.parsed),
            raw_output: row.rawOutput,
            source: row.source as ResolvedDecision['source'],
            valid: Boolean(row.valid),
            latency_ms: row.latencyMs,
            failure_reason: (row.failureReason ?? undefined) as ResolvedDecision['failure_reason'],
            prompt_version: row.promptVersion,
            model_id: row.modelId,
          });
        }

        resolver = createForkingResolver({
          parentDecisions,
          forkEventSeq: run.forkEventSeq,
          forkChange,
          baseResolver,
        });
      }

      const initialState = buildInitialState(seedState);
      const result = await simulate(initialState, events, resolver);

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
            d.prompt_version ??
            (d.decision.agent === 'pricing'
              ? version.pricingPromptVersion
              : version.inventoryPromptVersion),
          modelId: d.model_id ?? version.modelId,
          rawOutput: d.raw_output,
          parsed: d.decision,
          reasoning: d.decision.summary,
          source: d.source,
          valid: d.valid,
          latencyMs: d.latency_ms,
          failureReason: d.failure_reason ?? null,
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
