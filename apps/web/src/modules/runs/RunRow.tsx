import { Link } from '@tanstack/react-router';
import { ChevronRight, GitBranch } from 'lucide-react';

import type { Run } from '@back-stock/api/runs';

import { Badge } from '@repo/ui/shadcn/badge';
import { cn } from '@repo/ui/utils';
import { COMPARE_MAX_RUNS, useCompareStore } from '@/modules/compare/store';
import { formatDateTime, shortId } from '@/modules/core/lib/format';
import { RunStatusBadge } from '@/modules/runs/RunStatusBadge';

interface RunRowProps {
  run: Run;
}

export function RunRow({ run }: RunRowProps) {
  const selected = useCompareStore((state) => state.runIds.has(run.id));
  const atCapacity = useCompareStore((state) => state.runIds.size >= COMPARE_MAX_RUNS);
  const toggle = useCompareStore((state) => state.toggle);

  const isBranch = run.parent_run_id !== null;
  const checkboxDisabled = !selected && atCapacity;

  return (
    <li
      data-testid={`run-row-${run.id}`}
      data-state={selected ? 'selected' : undefined}
      className={cn(
        'bg-background/40 flex items-center gap-3 rounded-xl p-3 ring-1 ring-white/[0.04] transition-colors',
        selected && 'bg-primary/[0.07] ring-primary/30'
      )}
    >
      <label
        className={cn(
          'inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-white/[0.04]',
          checkboxDisabled && 'cursor-not-allowed opacity-40'
        )}
        title={checkboxDisabled ? `Compare up to ${COMPARE_MAX_RUNS} runs` : 'Add to compare'}
      >
        <input
          type="checkbox"
          data-testid={`run-compare-${run.id}`}
          checked={selected}
          disabled={checkboxDisabled}
          onChange={() => toggle(run.id)}
          className="size-4 cursor-pointer accent-[var(--primary)]"
          aria-label={`Select run ${shortId(run.id)} for comparison`}
        />
      </label>

      <Link
        to="/runs/$runId"
        params={{ runId: run.id }}
        data-testid={`run-link-${run.id}`}
        className="focus-visible:ring-ring flex flex-1 items-center justify-between gap-3 rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-foreground font-mono text-sm">{shortId(run.id)}</span>
            {run.label ? (
              <span className="font-display text-muted-foreground truncate text-sm font-medium">
                {run.label}
              </span>
            ) : null}
            {isBranch ? (
              <Badge variant="info" className="font-mono">
                <GitBranch />
                fork@{run.fork_event_seq}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground font-mono text-[11px]">
            {formatDateTime(run.created_at)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <RunStatusBadge status={run.status} />
          <ChevronRight className="text-muted-foreground size-4" />
        </div>
      </Link>
    </li>
  );
}
