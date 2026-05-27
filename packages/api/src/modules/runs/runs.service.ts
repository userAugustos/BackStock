import { findDayById } from '@api/modules/days/days.repository';
import { publish } from '@api/modules/queue/publisher';
import { findVersionById } from '@api/modules/versions/versions.repository';
import { badRequest, notFound } from '@core/errors';
import { logger } from '@core/logger';

import {
  findDecisionByRunAndSeq,
  findImpactByRunId,
  findRunById,
  findRunStepsByRunId,
  insertRun,
} from './runs.repository';

export async function startRun(dayId: string, versionId: string) {
  const day = await findDayById(dayId);
  if (!day) throw notFound('day_not_found', `Day '${dayId}' not found`);

  const version = await findVersionById(versionId);
  if (!version) throw notFound('version_not_found', `Version '${versionId}' not found`);

  const row = await insertRun({ dayId, versionId });

  try {
    const publishPromise = publish({
      exchange: 'runs',
      routingKey: 'run.requested',
      payload: { run_id: row.id },
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('publish timeout')), 2000)
    );
    await Promise.race([publishPromise, timeout]);
  } catch (err) {
    logger.warn('Failed to publish run.requested, run created but not queued', {
      run_id: row.id,
      error: err instanceof Error ? err.message : String(err),
    });
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
  };
}

export async function getRunTimeline(runId: string) {
  const run = await findRunById(runId);
  if (!run) throw notFound('run_not_found', `Run '${runId}' not found`);
  if (run.status !== 'done') throw badRequest('run_not_complete', 'Run has not completed yet');

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
  if (run.status !== 'done') throw badRequest('run_not_complete', 'Run has not completed yet');

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
  };
}
