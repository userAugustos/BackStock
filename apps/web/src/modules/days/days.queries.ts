import { queryOptions } from '@tanstack/react-query';
import type { MutationOptions } from '@tanstack/react-query';

import type {
  CreateDayBody,
  CreateDayResult,
  DayDetail,
  DayEvent,
  DayListItem,
} from '@back-stock/api/days';

import { apiData, backStockApi, dayApi } from '@/api';
import { queryKeys } from '@/modules/core/lib/queryKeys';

export const daysListQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.days.all,
    queryFn: () => apiData<DayListItem[]>(() => backStockApi.days.get()),
  });

export const dayDetailQueryOptions = (dayId: string) =>
  queryOptions({
    queryKey: queryKeys.days.detail(dayId),
    queryFn: () => apiData<DayDetail>(() => dayApi(dayId).get()),
  });

export const dayEventsQueryOptions = (dayId: string) =>
  queryOptions({
    queryKey: queryKeys.days.events(dayId),
    queryFn: () => apiData<DayEvent[]>(() => dayApi(dayId).events.get()),
  });

export const createDayMutationOptions = (): MutationOptions<
  CreateDayResult,
  Error,
  CreateDayBody
> => ({
  mutationFn: (body) => apiData<CreateDayResult>(() => backStockApi.days.post(body)),
});
