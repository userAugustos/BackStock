import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { GitCompareArrows, PlayCircle, RefreshCw } from 'lucide-react';

import { Badge } from '@repo/ui/shadcn/badge';
import { Button } from '@repo/ui/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/shadcn/card';
import { Skeleton } from '@repo/ui/shadcn/skeleton';
import { COMPARE_MAX_RUNS, useCompareStore } from '@/modules/compare/store';
import { EmptyPanel, ErrorPanel } from '@/modules/core/StatePanels';
import { RunRow } from '@/modules/runs/RunRow';
import { dayRunsQueryOptions, isRunActive } from '@/modules/runs/runs.queries';
import { StartRunControl } from '@/modules/runs/StartRunControl';

interface RunsListProps {
  dayId: string;
}

export function RunsList({ dayId }: RunsListProps) {
  const query = useQuery(dayRunsQueryOptions(dayId));
  const selectedCount = useCompareStore((state) => state.runIds.size);
  const clear = useCompareStore((state) => state.clear);

  const activeCount = query.data?.filter((run) => isRunActive(run.status)).length ?? 0;

  return (
    <Card data-testid="runs-list">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayCircle className="text-primary size-4" />
            Runs
            {activeCount > 0 ? (
              <Badge variant="signal" data-testid="runs-active-indicator" className="font-mono">
                <RefreshCw className="animate-spin" />
                {activeCount} live
              </Badge>
            ) : null}
          </CardTitle>
        </div>
        <StartRunControl dayId={dayId} />
      </CardHeader>

      <CardContent className="space-y-3">
        {selectedCount > 0 ? (
          <div
            data-testid="compare-bar"
            className="border-primary/30 bg-primary/[0.06] flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
          >
            <span className="text-foreground font-mono text-xs">
              {selectedCount}/{COMPARE_MAX_RUNS} selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => clear()} data-testid="compare-clear">
                Clear
              </Button>
              <Button
                asChild
                size="sm"
                disabled={selectedCount < 2}
                data-testid="compare-go"
                aria-disabled={selectedCount < 2}
              >
                <Link to="/compare" disabled={selectedCount < 2}>
                  <GitCompareArrows />
                  Compare
                </Link>
              </Button>
            </div>
          </div>
        ) : null}

        {query.isPending ? (
          <div className="space-y-2" data-testid="runs-loading">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorPanel
            message={query.error.message}
            onRetry={() => void query.refetch()}
            testid="runs-error"
          />
        ) : query.data.length === 0 ? (
          <EmptyPanel
            title="No runs yet"
            message="Pick a version above and start a run to replay this day."
            testid="runs-empty"
          />
        ) : (
          <ul className="space-y-2">
            {query.data.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
