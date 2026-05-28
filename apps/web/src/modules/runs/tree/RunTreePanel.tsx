import { useQuery } from '@tanstack/react-query';
import { GitBranch, RefreshCw } from 'lucide-react';

import { Badge } from '@repo/ui/shadcn/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/shadcn/card';
import { Skeleton } from '@repo/ui/shadcn/skeleton';
import { ErrorPanel } from '@/modules/core/StatePanels';
import { dayRunsQueryOptions, isRunActive } from '@/modules/runs/runs.queries';
import { StartRunControl } from '@/modules/runs/StartRunControl';
import { RunTree } from '@/modules/runs/tree/RunTree';

interface RunTreePanelProps {
  dayId: string;
}

export function RunTreePanel({ dayId }: RunTreePanelProps) {
  const query = useQuery(dayRunsQueryOptions(dayId));
  const activeCount = query.data?.filter((run) => isRunActive(run.status)).length ?? 0;

  return (
    <Card data-testid="run-tree-panel">
      <CardHeader className="gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="text-primary size-4" />
          Run tree
          {activeCount > 0 ? (
            <Badge variant="signal" data-testid="run-tree-active-indicator" className="font-mono">
              <RefreshCw className="animate-spin" />
              {activeCount} live
            </Badge>
          ) : null}
        </CardTitle>
        <StartRunControl dayId={dayId} />
      </CardHeader>

      <CardContent>
        {query.isPending ? (
          <div className="space-y-2" data-testid="run-tree-loading">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="ml-7 h-14 w-[calc(100%-1.75rem)]" />
          </div>
        ) : query.isError ? (
          <ErrorPanel
            message={query.error.message}
            onRetry={() => void query.refetch()}
            testid="run-tree-error"
          />
        ) : (
          <RunTree runs={query.data} />
        )}
      </CardContent>
    </Card>
  );
}
