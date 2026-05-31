import { Link } from '@tanstack/react-router';
import { ChevronRight, GitBranch } from 'lucide-react';

import type { RunListItem, RunStatus } from '@back-stock/api/runs';

import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/shadcn/tooltip';
import { cn } from '@repo/ui/utils';
import { COMPARE_MAX_RUNS, useCompareStore } from '@/modules/compare/store';
import { shortId } from '@/modules/core/lib/format';
import { RunNodeTooltip } from '@/modules/runs/tree/RunNodeTooltip';

const STATUS_DOT: Record<RunStatus, { tone: string; pulse: boolean; label: string }> = {
  queued: { tone: 'bg-muted-foreground/60', pulse: false, label: 'queued' },
  running: { tone: 'bg-primary', pulse: true, label: 'running' },
  done: { tone: 'bg-[var(--good)]', pulse: false, label: 'done' },
  done_degraded: { tone: 'bg-[var(--warning)]', pulse: false, label: 'done degraded' },
  failed: { tone: 'bg-[var(--danger)]', pulse: false, label: 'failed' },
};

interface RunTreeNodeProps {
  run: RunListItem;
}

export function RunTreeNode({ run }: RunTreeNodeProps) {
  const selected = useCompareStore((state) => state.runIds.has(run.id));
  const atCapacity = useCompareStore((state) => state.runIds.size >= COMPARE_MAX_RUNS);
  const compareDayId = useCompareStore((state) => state.dayId);
  const toggle = useCompareStore((state) => state.toggle);

  const dot = STATUS_DOT[run.status]!;
  const isBranch = run.parent_run_id !== null;
  const crossDay = compareDayId !== null && compareDayId !== run.day_id;
  const checkboxDisabled = !selected && (atCapacity || crossDay);
  const disabledReason = crossDay
    ? 'Compare requires runs from the same day'
    : atCapacity
      ? `Compare up to ${COMPARE_MAX_RUNS} runs`
      : 'Add to compare';

  return (
    <Tooltip>
      <div
        data-testid={`run-node-${run.id}`}
        data-state={selected ? 'selected' : undefined}
        className={cn(
          'bg-foreground/[0.02] ring-border/40 group flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1 transition-[background-color,box-shadow,border-color] duration-150',
          'hover:bg-foreground/[0.04] hover:ring-border/80',
          'hover:shadow-[var(--elevation-1)]',
          selected && 'bg-primary/[0.07] ring-primary/40'
        )}
      >
        <label
          className={cn(
            'hover:bg-foreground/[0.05] inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-[transform,background-color] duration-150 active:scale-[0.92]',
            checkboxDisabled && 'cursor-not-allowed opacity-40'
          )}
          title={disabledReason}
        >
          <input
            type="checkbox"
            data-testid={`run-node-compare-${run.id}`}
            checked={selected}
            disabled={checkboxDisabled}
            onChange={() => toggle(run.id, run.day_id)}
            className="size-3.5 cursor-pointer accent-[var(--primary)]"
            aria-label={`Select run ${shortId(run.id)} for comparison`}
          />
        </label>

        <TooltipTrigger asChild>
          <Link
            to="/runs/$runId"
            params={{ runId: run.id }}
            data-testid={`run-node-link-${run.id}`}
            className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-lg transition-transform duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.99]"
          >
            <span className="relative flex size-2.5 shrink-0 items-center justify-center">
              {dot.pulse ? (
                <span
                  className={cn(
                    'absolute inline-flex size-full animate-ping rounded-full opacity-60',
                    dot.tone
                  )}
                />
              ) : null}
              <span
                data-testid={`run-node-status-${run.id}`}
                className={cn('relative inline-flex size-2.5 rounded-full', dot.tone)}
                aria-label={dot.label}
              />
            </span>

            <span className="text-foreground font-mono text-sm">{shortId(run.id)}</span>
            {run.label ? (
              <span className="font-display text-muted-foreground truncate text-sm font-medium">
                {run.label}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">{isBranch ? 'branch' : 'root'}</span>
            )}

            <ChevronRight className="text-muted-foreground/60 group-hover:text-muted-foreground ml-auto size-4 shrink-0" />
          </Link>
        </TooltipTrigger>
      </div>

      <TooltipContent side="left" collisionPadding={12} className="p-3">
        <RunNodeTooltip run={run} />
      </TooltipContent>
    </Tooltip>
  );
}

export function ForkEdgeTag({ run }: { run: RunListItem }) {
  if (run.parent_run_id === null) return null;
  return (
    <span
      data-testid={`run-edge-tag-${run.id}`}
      className="text-muted-foreground inline-flex items-center gap-1 rounded-md bg-[var(--info)]/12 px-1.5 py-0.5 font-mono text-[10px] text-[var(--info)]"
    >
      <GitBranch className="size-3" />
      fork@{run.fork_event_seq} · {forkType(run)}
    </span>
  );
}

function forkType(run: RunListItem): string {
  if (!run.fork_change) return 'fork';
  return run.fork_change.type === 'version' ? 'version' : 'override';
}
