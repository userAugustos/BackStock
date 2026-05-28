import { GitFork } from 'lucide-react';

import type { CompareResult, CompareTimelineEntry } from '@back-stock/api/compare';

import { ScrollArea } from '@repo/ui/shadcn/scroll-area';
import { cn } from '@repo/ui/utils';
import {
  decisionFingerprint,
  describeDecision,
  readDecision,
  readState,
} from '@/modules/compare/compareMeta';
import { shortId } from '@/modules/core/lib/format';
import { computeStoreTotals } from '@/modules/runs/replay/replay.derive';
import type { RunColor } from '@/modules/compare/runColors';

interface AlignedTimelineProps {
  result: CompareResult;
  colors: Map<string, RunColor>;
}

/**
 * The override fires at `divergence_seq` (an event seq); the resulting step —
 * and the first differing decision — surfaces one step later.
 */
function divergenceStepSeq(result: CompareResult): number {
  return result.divergence_seq + 1;
}

/** A step's decisions differ when the runs don't all share one fingerprint. */
function decisionsDiffer(entry: CompareTimelineEntry, runIds: string[]): boolean {
  const prints = new Set(
    runIds.map((runId) => decisionFingerprint(readDecision(entry.decisions[runId])))
  );
  if (prints.size <= 1) return false;
  // All-empty already collapses to size 1; size > 1 means a real divergence.
  return true;
}

export function AlignedTimeline({ result, colors }: AlignedTimelineProps) {
  const runIds = result.runs.map((run) => run.run_id);
  const divergeAt = divergenceStepSeq(result);

  return (
    <ScrollArea className="max-h-[28rem] w-full" data-testid="aligned-timeline">
      <div className="overflow-hidden rounded-xl ring-1 ring-white/[0.06]">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-card/80 sticky top-0 z-10 backdrop-blur">
            <tr>
              <th className="text-muted-foreground h-9 px-3 text-left text-[11px] font-semibold tracking-wider uppercase">
                Step
              </th>
              {runIds.map((runId) => (
                <th
                  key={runId}
                  className="text-muted-foreground h-9 px-3 text-left text-[11px] font-semibold tracking-wider uppercase"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: colors.get(runId)?.cssVar }}
                    />
                    {shortId(runId)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.timeline.map((entry) => {
              const isDivergence = entry.seq === divergeAt;
              const differ = decisionsDiffer(entry, runIds);
              return (
                <tr
                  key={entry.seq}
                  data-testid={`timeline-row-${entry.seq}`}
                  data-divergence={isDivergence ? 'true' : undefined}
                  className={cn(
                    'border-border/50 border-b transition-colors last:border-0',
                    isDivergence
                      ? 'bg-[var(--info)]/[0.08]'
                      : differ
                        ? 'bg-[var(--warning)]/[0.05]'
                        : 'hover:bg-white/[0.02]'
                  )}
                >
                  <td className="px-3 py-2.5 align-top">
                    <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                      <span className="text-foreground">{entry.seq}</span>
                      {isDivergence ? (
                        <span
                          data-testid="timeline-divergence-marker"
                          className="inline-flex items-center gap-0.5 rounded bg-[var(--info)]/15 px-1 text-[10px] text-[var(--info)]"
                        >
                          <GitFork className="size-2.5" />
                          fork
                        </span>
                      ) : null}
                    </div>
                  </td>
                  {runIds.map((runId) => (
                    <TimelineCell
                      key={runId}
                      entry={entry}
                      runId={runId}
                      highlight={differ}
                      stepSeq={entry.seq}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  );
}

function TimelineCell({
  entry,
  runId,
  highlight,
  stepSeq,
}: {
  entry: CompareTimelineEntry;
  runId: string;
  highlight: boolean;
  stepSeq: number;
}) {
  const state = readState(entry.steps[runId]);
  const decision = readDecision(entry.decisions[runId]);
  const totals = state ? computeStoreTotals(state) : null;

  return (
    <td className="px-3 py-2.5 align-top" data-testid={`timeline-cell-${stepSeq}-${runId}`}>
      <div className="space-y-1">
        {totals ? (
          <span className="text-foreground/90 block font-mono text-xs tabular-nums">
            {totals.inventoryUnits} u
          </span>
        ) : (
          <span className="text-muted-foreground/50 block font-mono text-xs">—</span>
        )}
        {decision ? (
          <span
            data-testid={`timeline-decision-${stepSeq}-${runId}`}
            data-diff={highlight ? 'true' : undefined}
            className={cn(
              'inline-block rounded px-1.5 py-0.5 font-mono text-[10px] ring-1',
              highlight
                ? 'bg-[var(--warning)]/12 text-[var(--warning)] ring-[var(--warning)]/30'
                : 'bg-background/60 text-muted-foreground ring-white/[0.06]'
            )}
          >
            {describeDecision(decision)}
          </span>
        ) : null}
      </div>
    </td>
  );
}
