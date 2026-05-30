import { queryOptions } from '@tanstack/react-query';

import type { CompareResult } from '@back-stock/api/compare';

import { apiData, backStockApi } from '@/api';
import { queryKeys } from '@/modules/core/lib/queryKeys';

export const compareRunsQueryOptions = (runIds: readonly string[]) =>
  queryOptions({
    queryKey: queryKeys.compare.runs(runIds),
    queryFn: () =>
      apiData<CompareResult>(() =>
        backStockApi.compare.get({
          $query: {
            run_a: runIds[0]!,
            run_b: runIds[1]!,
            ...(runIds[2] ? { run_c: runIds[2] } : {}),
          },
        })
      ),
    enabled: runIds.length >= 2,
  });
