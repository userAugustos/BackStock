import { findDayById, findEventsByDayId } from '@api/modules/days/days.repository';
import { publish } from '@api/modules/queue/publisher';
import { RUN_REQUESTED_ROUTING_KEY, RUNS_EXCHANGE } from '@api/modules/queue/topology';
import { findVersionById } from '@api/modules/versions/versions.repository';
import type { ForkChange } from '@api/modules/simulation/simulation.types';
import { badRequest, internalError, notFound } from '@core/errors';
import { logger } from '@core/logger';

import {
  countDecisionsByRunId,
  findDecisionByRunAndSeq,
  findImpactByRunId,
  findRunById,
  findRunStepsByRunId,
  insertRun,
  updateRunStatus,
} from './runs.repository';
import { isCompletedRunStatus } from './runs.status';

/**
 * Creates a run and guarantees it was handed to RabbitMQ before returning 201.
 * If enqueueing fails, the persisted row is marked failed so clients do not see
 * a permanently queued run that no worker can process.
 */
export async function startRun(dayId: string, versionId: string) {
  const day = await findDayById(dayId);
  if (!day) throw notFound('day_not_found', `Day '${dayId}' not found`);

  const version = await findVersionById(versionId);
  if (!version) throw notFound('version_not_found', `Version '${versionId}' not found`);

  const row = await insertRun({ dayId, versionId });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const publishPromise = publish({
      exchange: RUNS_EXCHANGE,
      routingKey: RUN_REQUESTED_ROUTING_KEY,
      payload: { run_id: row.id },
    });
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('publish timeout')), 2000);
    });
    await Promise.race([publishPromise, timeout]);
  } catch (err) {
    await updateRunStatus(row.id, 'failed');
    logger.error('Failed to publish run.requested', {
      run_id: row.id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw internalError('run_enqueue_failed', `Run '${row.id}' could not be queued`);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  return {
    id: row.id,
    day_id: row.dayId,
    version_id: row.versionId,
    status: row.status,
    created_at: row.createdAt,
  };
}

export async function getRun(id: string) {
  const row = await findRunById(id);
  if (!row) throw notFound('run_not_found', `Run '${id}' not found`);
  const { total, failed } = await countDecisionsByRunId(id);
  return {
    id: row.id,
    day_id: row.dayId,
    version_id: row.versionId,
    parent_run_id: row.parentRunId,
    fork_event_seq: row.forkEventSeq,
    fork_change: row.forkChange ? JSON.parse(row.forkChange) : null,
    status: row.status,
    label: row.label,
    created_at: row.createdAt,
    completed_at: row.completedAt,
    decisions_total: total,
    decisions_failed: failed,
  };
}

export async function getRunTimeline(runId: string) {
  const run = await findRunById(runId);
  if (!run) throw notFound('run_not_found', `Run '${runId}' not found`);
  if (!isCompletedRunStatus(run.status))
    throw badRequest('run_not_complete', 'Run has not completed yet');

  const steps = await findRunStepsByRunId(runId);
  return steps.map((s) => ({
    seq: s.seq,
    state_snapshot: JSON.parse(s.stateSnapshot),
    order_state: JSON.parse(s.orderState),
    created_at: s.createdAt,
  }));
}

export async function getRunImpact(runId: string) {
  const run = await findRunById(runId);
  if (!run) throw notFound('run_not_found', `Run '${runId}' not found`);
  if (!isCompletedRunStatus(run.status))
    throw badRequest('run_not_complete', 'Run has not completed yet');

  const impact = await findImpactByRunId(runId);
  if (!impact) throw notFound('impact_not_found', `Impact for run '${runId}' not found`);

  return {
    waste_pct: impact.wastePct,
    waste_value: impact.wasteValue,
    stockout_events: impact.stockoutEvents,
    missed_revenue: impact.missedRevenue,
    ending_margin_pct: impact.endingMarginPct,
    ending_inventory_value: impact.endingInventoryValue,
    metrics: impact.metrics ? JSON.parse(impact.metrics) : null,
  };
}

export async function getRunDecision(runId: string, eventSeq: number) {
  const run = await findRunById(runId);
  if (!run) throw notFound('run_not_found', `Run '${runId}' not found`);

  const decision = await findDecisionByRunAndSeq(runId, eventSeq);
  if (!decision) throw notFound('decision_not_found', `Decision at seq ${eventSeq} not found`);

  return {
    event_seq: decision.eventSeq,
    agent: decision.agent,
    context_snapshot: JSON.parse(decision.contextSnapshot),
    prompt_version: decision.promptVersion,
    model_id: decision.modelId,
    raw_output: decision.rawOutput,
    parsed: JSON.parse(decision.parsed),
    reasoning: decision.reasoning,
    source: decision.source,
    valid: Boolean(decision.valid),
    latency_ms: decision.latencyMs,
    failure_reason: decision.failureReason,
  };
}

/**
 * Forks a completed parent run at an event seq and queues the branch for execution.
 * Two fork modes are supported via `change`:
 *   - `decision_override` — replace the agent decision at `atEventSeq` and recompute downstream
 *   - `version` — rerun the whole day under a different agent Version (fork at seq 0)
 * The new run is persisted with `parent_run_id` + `fork_event_seq` + `fork_change`;
 * the worker uses the parent's recorded decisions to replay pre-fork steps and the
 * configured base resolver for at/after-fork steps.
 */
export async function branchRun(parentRunId: string, atEventSeq: number, change: ForkChange) {
  const parentRun = await findRunById(parentRunId);
  if (!parentRun) throw notFound('run_not_found', `Run '${parentRunId}' not found`);
  if (!isCompletedRunStatus(parentRun.status))
    throw badRequest('run_not_complete', 'Can only branch a completed run');

  const events = await findEventsByDayId(parentRun.dayId);
  const maxSeq = events.length > 0 ? Math.max(...events.map((e) => e.seq)) : 0;
  if (atEventSeq > maxSeq)
    throw badRequest(
      'invalid_fork_seq',
      `at_event_seq ${atEventSeq} exceeds max event seq ${maxSeq}`
    );

  if (change.type === 'decision_override') {
    const parentDecision = await findDecisionByRunAndSeq(parentRunId, atEventSeq);
    if (!parentDecision)
      throw badRequest(
        'no_decision_at_seq',
        `No decision exists at event seq ${atEventSeq} in the parent run`
      );

    // The fork resolver returns the override verbatim to whichever agent the engine
    // invokes at this seq. If the override's agent or SKU differs from the parent's,
    // the engine silently no-ops (e.g. price stays unchanged) while the override is
    // still recorded — a "ghost" decision the timeline can't honestly reproduce.
    if (change.decision.agent !== parentDecision.agent)
      throw badRequest(
        'override_agent_mismatch',
        `Override agent '${change.decision.agent}' does not match parent decision agent '${parentDecision.agent}' at event seq ${atEventSeq}`
      );

    const parentSkuId = (JSON.parse(parentDecision.parsed) as { sku_id?: string }).sku_id;
    if (parentSkuId && change.decision.sku_id !== parentSkuId)
      throw badRequest(
        'override_sku_mismatch',
        `Override sku_id '${change.decision.sku_id}' does not match parent decision sku_id '${parentSkuId}' at event seq ${atEventSeq}`
      );
  }

  let versionId = parentRun.versionId;
  if (change.type === 'version') {
    const version = await findVersionById(change.version_id);
    if (!version) throw notFound('version_not_found', `Version '${change.version_id}' not found`);
    versionId = change.version_id;
  }

  const row = await insertRun({
    dayId: parentRun.dayId,
    versionId,
    parentRunId,
    forkEventSeq: atEventSeq,
    forkChange: change as unknown as Record<string, unknown>,
  });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const publishPromise = publish({
      exchange: RUNS_EXCHANGE,
      routingKey: RUN_REQUESTED_ROUTING_KEY,
      payload: { run_id: row.id },
    });
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('publish timeout')), 2000);
    });
    await Promise.race([publishPromise, timeout]);
  } catch (err) {
    await updateRunStatus(row.id, 'failed');
    logger.error('Failed to publish run.requested for branch', {
      run_id: row.id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw internalError('run_enqueue_failed', `Run '${row.id}' could not be queued`);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  return {
    id: row.id,
    day_id: row.dayId,
    version_id: row.versionId,
    parent_run_id: row.parentRunId,
    fork_event_seq: row.forkEventSeq,
    fork_change: row.forkChange ? JSON.parse(row.forkChange) : null,
    status: row.status,
    created_at: row.createdAt,
  };
}
