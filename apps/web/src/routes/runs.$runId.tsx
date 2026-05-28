import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { Skeleton } from '@repo/ui/shadcn/skeleton';
import { ErrorPanel } from '@/modules/core/StatePanels';
import { dayEventsQueryOptions } from '@/modules/days/days.queries';
import { ReplayHeader } from '@/modules/runs/replay/ReplayHeader';
import { ReplayScreen } from '@/modules/runs/replay/ReplayScreen';
import { ExecutingState, FailedState } from '@/modules/runs/replay/ReplayStatusStates';
import {
  runImpactQueryOptions,
  runQueryOptions,
  runTimelineQueryOptions,
} from '@/modules/runs/runs.queries';

export const Route = createFileRoute('/runs/$runId')({
  component: RunDetail,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(runQueryOptions(params.runId)),
});

function RunDetail() {
  const { runId } = Route.useParams();
  const runQuery = useQuery(runQueryOptions(runId));

  const isDone = runQuery.data?.status === 'done';

  const timelineQuery = useQuery(runTimelineQueryOptions(runId, isDone));
  const impactQuery = useQuery(runImpactQueryOptions(runId, isDone));
  const eventsQuery = useQuery({
    ...dayEventsQueryOptions(runQuery.data?.day_id ?? ''),
    enabled: isDone && Boolean(runQuery.data?.day_id),
  });

  if (runQuery.isPending) {
    return (
      <div className="space-y-6" data-testid="replay-loading">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (runQuery.isError) {
    return (
      <ErrorPanel
        title="Couldn't load this run"
        message={runQuery.error.message}
        onRetry={() => void runQuery.refetch()}
        testid="replay-error"
      />
    );
  }

  const run = runQuery.data;

  if (run.status === 'queued' || run.status === 'running') {
    return (
      <div className="space-y-6">
        <ReplayHeader run={run} />
        <ExecutingState status={run.status} />
      </div>
    );
  }

  if (run.status === 'failed') {
    return (
      <div className="space-y-6">
        <ReplayHeader run={run} />
        <FailedState />
      </div>
    );
  }

  if (timelineQuery.isError || impactQuery.isError) {
    const message = timelineQuery.error?.message ?? impactQuery.error?.message ?? 'Request failed';
    return (
      <div className="space-y-6">
        <ReplayHeader run={run} />
        <ErrorPanel
          title="Couldn't load the replay"
          message={message}
          onRetry={() => {
            void timelineQuery.refetch();
            void impactQuery.refetch();
          }}
          testid="replay-data-error"
        />
      </div>
    );
  }

  if (
    timelineQuery.isPending ||
    impactQuery.isPending ||
    eventsQuery.isPending ||
    !timelineQuery.data ||
    !impactQuery.data ||
    !eventsQuery.data
  ) {
    return (
      <div className="space-y-6" data-testid="replay-data-loading">
        <ReplayHeader run={run} />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <ReplayScreen
      run={run}
      timeline={timelineQuery.data}
      impact={impactQuery.data}
      events={eventsQuery.data}
    />
  );
}
