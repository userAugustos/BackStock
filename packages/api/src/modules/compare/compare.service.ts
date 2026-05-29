import {
  findDecisionsByRunId,
  findImpactByRunId,
  findRunById,
  findRunStepsByRunId,
} from '@api/modules/runs/runs.repository';
import { badRequest, notFound } from '@core/errors';

export interface CompareRunMeta {
  run_id: string;
  version_id: string;
  parent_run_id: string | null;
  fork_event_seq: number | null;
  label: string | null;
}

export interface CompareStepEntry {
  state_snapshot: Record<string, unknown>;
  order_state: Record<string, unknown>[];
}

export interface CompareDecisionEntry {
  agent: string;
  parsed: unknown;
  source: string;
  reasoning: string;
}

export interface CompareTimelineEntry {
  seq: number;
  steps: Record<string, CompareStepEntry>;
  decisions: Record<string, CompareDecisionEntry | null>;
}

export interface ImpactValues {
  waste_pct: number;
  waste_value: number;
  stockout_events: number;
  missed_revenue: number;
  ending_margin_pct: number;
  ending_inventory_value: number;
}

export interface ImpactDelta extends ImpactValues {
  pair: [string, string];
}

export interface CompareResult {
  day_id: string;
  runs: CompareRunMeta[];
  divergence_seq: number;
  timeline: CompareTimelineEntry[];
  impact: {
    per_run: Record<string, ImpactValues>;
    deltas: ImpactDelta[];
  };
}

function computeDelta(a: ImpactValues, b: ImpactValues): ImpactValues {
  const round = (x: number) => Math.round(x * 100) / 100;
  return {
    waste_pct: round(b.waste_pct - a.waste_pct),
    waste_value: round(b.waste_value - a.waste_value),
    stockout_events: b.stockout_events - a.stockout_events,
    missed_revenue: round(b.missed_revenue - a.missed_revenue),
    ending_margin_pct: round(b.ending_margin_pct - a.ending_margin_pct),
    ending_inventory_value: round(b.ending_inventory_value - a.ending_inventory_value),
  };
}

/**
 * Aligns the timelines of 2 or 3 runs of the same day onto a single seq-indexed view
 * and computes pairwise impact deltas. Alignment is by step `seq`: each entry exposes
 * each run's step snapshot at that seq (when present) and the decision recorded against
 * the preceding event (`event_seq = seq - 1`), so divergent branches sit side by side
 * without renumbering. `divergence_seq` is the smallest non-null `fork_event_seq` across
 * the compared runs — the earliest point any branch left the parent's path; when all
 * runs are root runs it falls back to 0, meaning the entire timeline is shared.
 */
export async function compareRuns(runIds: string[]): Promise<CompareResult> {
  if (runIds.length < 2 || runIds.length > 3)
    throw badRequest('invalid_run_count', 'Compare requires 2 or 3 run IDs');

  const uniqueIds = [...new Set(runIds)];
  if (uniqueIds.length !== runIds.length)
    throw badRequest('duplicate_run_ids', 'Run IDs must be distinct');

  const runRows = await Promise.all(uniqueIds.map((id) => findRunById(id)));
  for (let i = 0; i < uniqueIds.length; i++) {
    if (!runRows[i]) throw notFound('run_not_found', `Run '${uniqueIds[i]}' not found`);
  }

  const runs = runRows as NonNullable<(typeof runRows)[number]>[];

  const dayIds = new Set(runs.map((r) => r.dayId));
  if (dayIds.size !== 1)
    throw badRequest('different_days', 'All compared runs must belong to the same day');

  for (const run of runs) {
    if (run.status !== 'done')
      throw badRequest('run_not_complete', `Run '${run.id}' has not completed yet`);
  }

  const dayId = runs[0]!.dayId;

  const forkSeqs = runs.map((r) => r.forkEventSeq).filter((s): s is number => s !== null);
  const divergenceSeq = forkSeqs.length > 0 ? Math.min(...forkSeqs) : 0;

  const [allSteps, allDecisions, allImpacts] = await Promise.all([
    Promise.all(runs.map((r) => findRunStepsByRunId(r.id))),
    Promise.all(runs.map((r) => findDecisionsByRunId(r.id))),
    Promise.all(runs.map((r) => findImpactByRunId(r.id))),
  ]);

  const maxStepSeq = Math.max(...allSteps.flatMap((steps) => steps.map((s) => s.seq)), 0);

  const decisionsByRunAndSeq = new Map<
    string,
    Map<number, (typeof allDecisions)[number][number]>
  >();
  for (let i = 0; i < runs.length; i++) {
    const map = new Map<number, (typeof allDecisions)[number][number]>();
    for (const d of allDecisions[i]!) {
      map.set(d.eventSeq, d);
    }
    decisionsByRunAndSeq.set(runs[i]!.id, map);
  }

  const stepsByRunAndSeq = new Map<string, Map<number, (typeof allSteps)[number][number]>>();
  for (let i = 0; i < runs.length; i++) {
    const map = new Map<number, (typeof allSteps)[number][number]>();
    for (const s of allSteps[i]!) {
      map.set(s.seq, s);
    }
    stepsByRunAndSeq.set(runs[i]!.id, map);
  }

  const timeline: CompareTimelineEntry[] = [];
  for (let seq = 0; seq <= maxStepSeq; seq++) {
    const steps: Record<string, CompareStepEntry> = {};
    const decisions: Record<string, CompareDecisionEntry | null> = {};

    for (const run of runs) {
      const stepMap = stepsByRunAndSeq.get(run.id)!;
      const step = stepMap.get(seq);
      if (step) {
        steps[run.id] = {
          state_snapshot: JSON.parse(step.stateSnapshot) as Record<string, unknown>,
          order_state: JSON.parse(step.orderState) as Record<string, unknown>[],
        };
      }

      const decMap = decisionsByRunAndSeq.get(run.id)!;
      const eventSeq = seq - 1;
      const dec = eventSeq >= 0 ? decMap.get(eventSeq) : undefined;
      if (dec) {
        decisions[run.id] = {
          agent: dec.agent,
          parsed: JSON.parse(dec.parsed),
          source: dec.source,
          reasoning: dec.reasoning,
        };
      } else {
        decisions[run.id] = null;
      }
    }

    timeline.push({ seq, steps, decisions });
  }

  const perRun: Record<string, ImpactValues> = {};
  for (let i = 0; i < runs.length; i++) {
    const impact = allImpacts[i];
    if (!impact) throw notFound('impact_not_found', `Impact for run '${runs[i]!.id}' not found`);
    perRun[runs[i]!.id] = {
      waste_pct: impact.wastePct,
      waste_value: impact.wasteValue,
      stockout_events: impact.stockoutEvents,
      missed_revenue: impact.missedRevenue,
      ending_margin_pct: impact.endingMarginPct,
      ending_inventory_value: impact.endingInventoryValue,
    };
  }

  const deltas: ImpactDelta[] = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const idA = runs[i]!.id;
      const idB = runs[j]!.id;
      deltas.push({
        pair: [idA, idB],
        ...computeDelta(perRun[idA]!, perRun[idB]!),
      });
    }
  }

  return {
    day_id: dayId,
    runs: runs.map((r) => ({
      run_id: r.id,
      version_id: r.versionId,
      parent_run_id: r.parentRunId,
      fork_event_seq: r.forkEventSeq,
      label: r.label,
    })),
    divergence_seq: divergenceSeq,
    timeline,
    impact: { per_run: perRun, deltas },
  };
}
