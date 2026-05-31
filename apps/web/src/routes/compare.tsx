import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { GitCompareArrows } from 'lucide-react';
import { z } from 'zod';

import { Skeleton } from '@repo/ui/shadcn/skeleton';
import { ApiResponseError } from '@/api';
import { compareRunsQueryOptions } from '@/modules/compare/compare.queries';
import { CompareScreen } from '@/modules/compare/CompareScreen';
import { useCompareStore } from '@/modules/compare/store';
import { EmptyPanel, ErrorPanel } from '@/modules/core/StatePanels';

const compareSearchSchema = z.object({
  run_a: z.string().min(1).optional(),
  run_b: z.string().min(1).optional(),
  run_c: z.string().min(1).optional(),
  run_d: z.string().min(1).optional(),
});

type CompareSearch = z.infer<typeof compareSearchSchema>;

export const Route = createFileRoute('/compare')({
  validateSearch: (search): CompareSearch => compareSearchSchema.parse(search),
  component: ComparePage,
});

/** Distinct, defined run ids drawn from the URL (the linkable source of truth). */
function runIdsFromSearch(search: CompareSearch): string[] {
  const raw = [search.run_a, search.run_b, search.run_c, search.run_d].filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
  return [...new Set(raw)];
}

const ERROR_COPY: Record<string, string> = {
  different_days: 'These runs belong to different days. Compare runs from the same day.',
  run_not_complete: 'One of these runs has not finished yet. Wait for it to complete.',
  duplicate_run_ids: 'The selected runs are not distinct.',
  invalid_run_count: 'Select 2–4 runs to compare.',
  run_not_found: 'One of these runs no longer exists.',
};

function ComparePage() {
  const search = Route.useSearch();
  const storeIds = useCompareStore((state) => state.runIds);

  const urlIds = runIdsFromSearch(search);
  const runIds = urlIds.length >= 2 ? urlIds : [...storeIds].slice(0, 3);

  const query = useQuery(compareRunsQueryOptions(runIds));

  if (runIds.length < 2) {
    return (
      <div data-testid="compare-empty-state" className="mx-auto max-w-xl py-12">
        <EmptyPanel
          title="Pick runs to compare"
          message="Select 2–4 runs of the same day from a day's run tree to see their outcomes side by side."
          icon={<GitCompareArrows className="size-5" />}
          action={
            <Link
              to="/"
              data-testid="compare-empty-home-link"
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              Back to days
            </Link>
          }
          testid="compare-empty"
        />
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className="space-y-6" data-testid="compare-loading">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError) {
    const code = query.error instanceof ApiResponseError ? query.error.code : undefined;
    const message = (code && ERROR_COPY[code]) || query.error.message;
    return (
      <div className="mx-auto max-w-xl py-12">
        <ErrorPanel
          title="Couldn't compare these runs"
          message={message}
          onRetry={() => void query.refetch()}
          testid="compare-error"
        />
      </div>
    );
  }

  return <CompareScreen result={query.data} />;
}
