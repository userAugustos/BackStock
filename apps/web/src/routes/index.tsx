import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarRange } from 'lucide-react';
import { motion } from 'motion/react';

import { Skeleton } from '@repo/ui/shadcn/skeleton';
import { staggerContainer, staggerItem } from '@/modules/core/lib/motion';
import { EmptyPanel, ErrorPanel } from '@/modules/core/StatePanels';
import { DayCard } from '@/modules/days/DayCard';
import { daysListQueryOptions } from '@/modules/days/days.queries';
import { UploadDayDialog } from '@/modules/days/UploadDayDialog';

export const Route = createFileRoute('/')({
  component: DaysIndex,
  loader: ({ context }) => context.queryClient.ensureQueryData(daysListQueryOptions()),
});

function DaysIndex() {
  const query = useQuery(daysListQueryOptions());

  return (
    <div data-testid="home" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Store days</h1>
          <p className="text-muted-foreground text-sm">
            Upload an event stream, replay it through the agents, then branch and compare outcomes.
          </p>
        </div>
        <UploadDayDialog />
      </header>

      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="days-loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorPanel
          title="Couldn't load days"
          message={query.error.message}
          onRetry={() => void query.refetch()}
          testid="days-error"
        />
      ) : query.data.length === 0 ? (
        <EmptyPanel
          title="No store days yet"
          message="Upload your first store day to get started."
          icon={<CalendarRange className="size-5" />}
          action={<UploadDayDialog />}
          testid="days-empty"
        />
      ) : (
        <motion.ul
          data-testid="days-grid"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {query.data.map((day) => (
            <motion.li key={day.id} variants={staggerItem}>
              <DayCard day={day} />
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
