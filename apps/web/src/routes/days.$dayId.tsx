import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Boxes, FilterX, Truck, Zap } from 'lucide-react';
import { m } from 'motion/react';

import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/shadcn/card';
import { Skeleton } from '@repo/ui/shadcn/skeleton';
import { staggerContainer, staggerItem } from '@/modules/core/lib/motion';
import { ErrorPanel } from '@/modules/core/StatePanels';
import { CatalogTable } from '@/modules/days/CatalogTable';
import { DayHeader } from '@/modules/days/DayHeader';
import { dayDetailQueryOptions, dayEventsQueryOptions } from '@/modules/days/days.queries';
import { EventsTable } from '@/modules/days/EventsTable';
import { IgnoredReport } from '@/modules/days/IgnoredReport';
import { VendorsList } from '@/modules/days/VendorsList';
import { RunTreePanel } from '@/modules/runs/tree/RunTreePanel';
import { VersionsPanel } from '@/modules/versions/VersionsPanel';

export const Route = createFileRoute('/days/$dayId')({
  component: DayDetail,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(dayDetailQueryOptions(params.dayId)),
});

function DayDetail() {
  const { dayId } = Route.useParams();
  const dayQuery = useQuery(dayDetailQueryOptions(dayId));
  const eventsQuery = useQuery(dayEventsQueryOptions(dayId));

  if (dayQuery.isPending) {
    return (
      <div className="space-y-6" data-testid="day-loading">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (dayQuery.isError) {
    return (
      <ErrorPanel
        title="Couldn't load this day"
        message={dayQuery.error.message}
        onRetry={() => void dayQuery.refetch()}
        testid="day-error"
      />
    );
  }

  const day = dayQuery.data;

  return (
    <m.div
      data-testid="day-detail"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <m.div variants={staggerItem}>
        <DayHeader day={day} />
      </m.div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <m.div variants={staggerItem}>
            <Card data-testid="catalog-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Boxes className="text-primary size-4" />
                  Catalog
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CatalogTable seedState={day.seed_state} />
              </CardContent>
            </Card>
          </m.div>

          <m.div variants={staggerItem}>
            <Card data-testid="events-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="text-primary size-4" />
                  Event stream
                </CardTitle>
              </CardHeader>
              <CardContent>
                {eventsQuery.isPending ? (
                  <div className="space-y-2" data-testid="events-loading">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : eventsQuery.isError ? (
                  <ErrorPanel
                    message={eventsQuery.error.message}
                    onRetry={() => void eventsQuery.refetch()}
                    testid="events-error"
                  />
                ) : (
                  <EventsTable events={eventsQuery.data} />
                )}
              </CardContent>
            </Card>
          </m.div>
        </div>

        <div className="space-y-6">
          <m.div variants={staggerItem}>
            <Card data-testid="vendors-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="text-primary size-4" />
                  Vendors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VendorsList seedState={day.seed_state} />
              </CardContent>
            </Card>
          </m.div>

          <m.div variants={staggerItem}>
            <VersionsPanel />
          </m.div>

          <m.div variants={staggerItem}>
            <RunTreePanel dayId={dayId} />
          </m.div>

          <m.div variants={staggerItem}>
            <Card data-testid="ignored-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FilterX className="size-4 text-[var(--warning)]" />
                  Ignored events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <IgnoredReport report={day.ignored_report} />
              </CardContent>
            </Card>
          </m.div>
        </div>
      </div>
    </m.div>
  );
}
