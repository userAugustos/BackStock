import { and, eq } from 'drizzle-orm';

import { db } from '@api/db/client';
import { decisions, impacts, runs, runSteps } from '@api/db/schema';
import type { Impact as SimImpact, SimState } from '@api/modules/simulation/simulation.types';

interface InsertRunData {
  dayId: string;
  versionId: string;
  parentRunId?: string | null;
  forkEventSeq?: number | null;
  forkChange?: Record<string, unknown> | null;
  status?: string;
  label?: string | null;
}

export function insertRun(data: InsertRunData) {
  const id = crypto.randomUUID();
  return db
    .insert(runs)
    .values({
      id,
      dayId: data.dayId,
      versionId: data.versionId,
      parentRunId: data.parentRunId ?? null,
      forkEventSeq: data.forkEventSeq ?? null,
      forkChange: data.forkChange ? JSON.stringify(data.forkChange) : null,
      status: data.status ?? 'queued',
      label: data.label ?? null,
    })
    .returning()
    .then((rows) => rows[0]!);
}

export function findRunById(id: string) {
  return db
    .select()
    .from(runs)
    .where(eq(runs.id, id))
    .then((rows) => rows[0]);
}

export function updateRunStatus(id: string, status: string, completedAt?: string) {
  return db
    .update(runs)
    .set({ status, ...(completedAt ? { completedAt } : {}) })
    .where(eq(runs.id, id));
}

interface InsertRunStepData {
  runId: string;
  seq: number;
  stateSnapshot: SimState;
  orderState: unknown[];
}

export function insertRunSteps(stepsData: InsertRunStepData[]) {
  if (stepsData.length === 0) return Promise.resolve([]);
  return db
    .insert(runSteps)
    .values(
      stepsData.map((s) => ({
        id: crypto.randomUUID(),
        runId: s.runId,
        seq: s.seq,
        stateSnapshot: JSON.stringify(s.stateSnapshot),
        orderState: JSON.stringify(s.orderState),
      }))
    )
    .returning();
}

export function findRunStepsByRunId(runId: string) {
  return db.select().from(runSteps).where(eq(runSteps.runId, runId)).orderBy(runSteps.seq);
}

interface InsertDecisionData {
  runId: string;
  eventSeq: number;
  agent: string;
  contextSnapshot: SimState;
  promptVersion: string;
  modelId: string;
  rawOutput: string;
  parsed: unknown;
  reasoning: string;
  source: string;
  valid: boolean;
  latencyMs: number;
}

export function insertDecisions(decisionsData: InsertDecisionData[]) {
  if (decisionsData.length === 0) return Promise.resolve([]);
  return db
    .insert(decisions)
    .values(
      decisionsData.map((d) => ({
        id: crypto.randomUUID(),
        runId: d.runId,
        eventSeq: d.eventSeq,
        agent: d.agent,
        contextSnapshot: JSON.stringify(d.contextSnapshot),
        promptVersion: d.promptVersion,
        modelId: d.modelId,
        rawOutput: d.rawOutput,
        parsed: JSON.stringify(d.parsed),
        reasoning: d.reasoning,
        source: d.source,
        valid: d.valid ? 1 : 0,
        latencyMs: d.latencyMs,
      }))
    )
    .returning();
}

export function findDecisionByRunAndSeq(runId: string, eventSeq: number) {
  return db
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.eventSeq, eventSeq)))
    .then((rows) => rows[0]);
}

interface InsertImpactData {
  runId: string;
  impact: SimImpact;
}

export function insertImpact(data: InsertImpactData) {
  const id = crypto.randomUUID();
  return db
    .insert(impacts)
    .values({
      id,
      runId: data.runId,
      wastePct: data.impact.waste_pct,
      wasteValue: data.impact.waste_value,
      stockoutEvents: data.impact.stockout_events,
      missedRevenue: data.impact.missed_revenue,
      endingMarginPct: data.impact.ending_margin_pct,
      endingInventoryValue: data.impact.ending_inventory_value,
      metrics: data.impact.metrics ? JSON.stringify(data.impact.metrics) : null,
    })
    .returning()
    .then((rows) => rows[0]!);
}

export function findImpactByRunId(runId: string) {
  return db
    .select()
    .from(impacts)
    .where(eq(impacts.runId, runId))
    .then((rows) => rows[0]);
}
