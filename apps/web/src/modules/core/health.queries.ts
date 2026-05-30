import { queryOptions } from '@tanstack/react-query';

import { apiCall, backStockApi } from '@/api';
import { queryKeys } from '@/modules/core/lib/queryKeys';

export interface HealthStatus {
  status: string;
  version: string;
  timestamp: string;
}

export const healthQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.health,
    queryFn: () => apiCall<HealthStatus>(() => backStockApi.healthz.get()),
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: 1,
  });
