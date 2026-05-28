import { queryOptions } from '@tanstack/react-query';
import type { MutationOptions } from '@tanstack/react-query';

import type { CreateVersionBody, Version } from '@back-stock/api/versions';

import { apiData, backStockApi } from '@/api';
import { queryKeys } from '@/modules/core/lib/queryKeys';

export const versionsListQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.versions.all,
    queryFn: () => apiData<Version[]>(() => backStockApi.versions.get()),
  });

export const createVersionMutationOptions = (): MutationOptions<
  Version,
  Error,
  CreateVersionBody
> => ({
  mutationFn: (body) => apiData<Version>(() => backStockApi.versions.post(body)),
});
