import { lazy, Suspense } from 'react';

import type { CompareResult } from '@back-stock/api/compare';

import { Skeleton } from '@repo/ui/shadcn/skeleton';
import type { RunColor } from '@/modules/compare/runColors';

const ImpactBarChartImpl = lazy(() => import('@/modules/compare/ImpactBarChart.chart'));

interface ImpactBarChartProps {
  result: CompareResult;
  colors: Map<string, RunColor>;
}

export function ImpactBarChart(props: ImpactBarChartProps) {
  return (
    <Suspense
      fallback={
        <Skeleton className="h-64 w-full rounded-xl" data-testid="impact-bar-chart-loading" />
      }
    >
      <ImpactBarChartImpl {...props} />
    </Suspense>
  );
}
