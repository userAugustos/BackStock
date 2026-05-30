import { lazy, Suspense } from 'react';

import { Skeleton } from '@repo/ui/shadcn/skeleton';
import type { StepSeriesPoint } from '@/modules/runs/replay/replay.derive';

const StateSparklinesImpl = lazy(() => import('@/modules/runs/replay/StateSparklines.chart'));

interface StateSparklinesProps {
  series: StepSeriesPoint[];
  currentStep: number;
}

export function StateSparklines(props: StateSparklinesProps) {
  return (
    <Suspense fallback={<SparklinesFallback />}>
      <StateSparklinesImpl {...props} />
    </Suspense>
  );
}

function SparklinesFallback() {
  return (
    <div className="grid grid-cols-3 gap-3" data-testid="state-sparklines-loading">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[4.75rem] w-full rounded-xl" />
      ))}
    </div>
  );
}
