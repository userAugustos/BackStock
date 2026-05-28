import { useQuery } from '@tanstack/react-query';
import { Boxes, Cpu, GitBranch } from 'lucide-react';

import type { Version } from '@back-stock/api/versions';

import { Badge } from '@repo/ui/shadcn/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/shadcn/card';
import { Skeleton } from '@repo/ui/shadcn/skeleton';
import { formatDateTime, shortId } from '@/modules/core/lib/format';
import { EmptyPanel, ErrorPanel } from '@/modules/core/StatePanels';
import { NewVersionDialog } from '@/modules/versions/NewVersionDialog';
import { versionsListQueryOptions } from '@/modules/versions/versions.queries';

export function VersionsPanel() {
  const query = useQuery(versionsListQueryOptions());

  return (
    <Card data-testid="versions-panel">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="text-primary size-4" />
          Versions
        </CardTitle>
        <NewVersionDialog />
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div className="space-y-2" data-testid="versions-loading">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorPanel
            message={query.error.message}
            onRetry={() => void query.refetch()}
            testid="versions-error"
          />
        ) : query.data.length === 0 ? (
          <EmptyPanel
            title="No versions yet"
            message="Create a version to replay this day through the agents."
            testid="versions-empty"
          />
        ) : (
          <ul className="space-y-2">
            {query.data.map((version) => (
              <VersionRow key={version.id} version={version} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function VersionRow({ version }: { version: Version }) {
  return (
    <li
      data-testid={`version-row-${version.id}`}
      className="bg-background/40 rounded-xl p-3 ring-1 ring-white/[0.04]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-semibold">{version.label}</span>
        <span className="text-muted-foreground font-mono text-xs">{shortId(version.id)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="muted" className="font-mono">
          <Cpu />
          {version.model_id}
        </Badge>
        <Badge variant="outline" className="font-mono">
          <Boxes />
          {version.inventory_prompt_version}
        </Badge>
        <Badge variant="outline" className="font-mono">
          {version.pricing_prompt_version}
        </Badge>
      </div>
      <p className="text-muted-foreground mt-2 font-mono text-[11px]">
        {formatDateTime(version.created_at)}
      </p>
    </li>
  );
}
