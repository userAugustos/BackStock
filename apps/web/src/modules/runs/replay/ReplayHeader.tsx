import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, GitBranch, GitFork } from 'lucide-react';

import type { Run } from '@back-stock/api/runs';
import type { ForkChange } from '@back-stock/api/simulation';

import { Badge } from '@repo/ui/shadcn/badge';
import { Button } from '@repo/ui/shadcn/button';
import { cn } from '@repo/ui/utils';
import { COMPARE_MAX_RUNS, useCompareStore } from '@/modules/compare/store';
import { shortId } from '@/modules/core/lib/format';
import { dayDetailQueryOptions } from '@/modules/days/days.queries';
import { RunStatusBadge } from '@/modules/runs/RunStatusBadge';
import { versionsListQueryOptions } from '@/modules/versions/versions.queries';

interface ReplayHeaderProps {
  run: Run;
}

function describeForkChange(change: ForkChange | null): string {
  if (!change) return 'fork';
  if (change.type === 'version') return `version → ${shortId(change.version_id)}`;
  const decision = change.decision;
  if (decision.agent === 'inventory') {
    return `override ${decision.sku_id} → ${decision.order_cases} cases`;
  }
  return `override ${decision.sku_id} → $${decision.new_price}`;
}

export function ReplayHeader({ run }: ReplayHeaderProps) {
  const dayQuery = useQuery(dayDetailQueryOptions(run.day_id));
  const versionsQuery = useQuery(versionsListQueryOptions());

  const versionLabel =
    versionsQuery.data?.find((version) => version.id === run.version_id)?.label ??
    shortId(run.version_id);

  const selected = useCompareStore((state) => state.runIds.has(run.id));
  const atCapacity = useCompareStore((state) => state.runIds.size >= COMPARE_MAX_RUNS);
  const toggle = useCompareStore((state) => state.toggle);
  const checkboxDisabled = !selected && atCapacity;

  const isBranch = run.parent_run_id !== null;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link to="/days/$dayId" params={{ dayId: run.day_id }} data-testid="back-to-day">
          <ArrowLeft />
          {dayQuery.data ? dayQuery.data.name : 'Back to day'}
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <RunStatusBadge status={run.status} />
            <Badge variant="outline" className="font-mono" data-testid="replay-version">
              {versionLabel}
            </Badge>
            {isBranch ? (
              <Badge variant="info" className="font-mono" data-testid="replay-fork-badge">
                <GitBranch />
                fork@{run.fork_event_seq}
              </Badge>
            ) : null}
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            Replay{' '}
            <span className="text-muted-foreground font-mono text-xl" data-testid="replay-run-id">
              {shortId(run.id)}
            </span>
          </h1>

          {isBranch ? (
            <p
              data-testid="replay-fork-lineage"
              className="text-muted-foreground inline-flex items-center gap-1.5 font-mono text-xs"
            >
              <GitFork className="size-3.5" />
              forked from{' '}
              <Link
                to="/runs/$runId"
                params={{ runId: run.parent_run_id ?? '' }}
                className="text-foreground hover:text-primary underline-offset-2 hover:underline"
                data-testid="replay-parent-link"
              >
                {shortId(run.parent_run_id ?? '')}
              </Link>
              <span aria-hidden>·</span>
              {describeForkChange(run.fork_change)}
            </p>
          ) : null}
        </div>

        <label
          className={cn(
            'bg-card ring-foreground/[0.06] flex cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 ring-1 transition-colors',
            selected && 'ring-primary/40 bg-primary/[0.07]',
            checkboxDisabled && 'cursor-not-allowed opacity-50'
          )}
          title={checkboxDisabled ? `Compare up to ${COMPARE_MAX_RUNS} runs` : 'Add to compare'}
        >
          <input
            type="checkbox"
            data-testid="replay-compare-toggle"
            checked={selected}
            disabled={checkboxDisabled}
            onChange={() => toggle(run.id)}
            className="size-4 cursor-pointer accent-[var(--primary)]"
            aria-label="Add this run to compare"
          />
          <span className="text-foreground text-sm font-medium">Compare</span>
        </label>
      </div>
    </div>
  );
}
