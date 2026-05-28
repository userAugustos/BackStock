import { edenTreaty } from '@elysiajs/eden';
import type { z } from 'zod';

import type { BackStockApi as BackStockApiType } from '@back-stock/api/client';

import { webEnv } from '@/modules/core/lib/env';

const API_URL = webEnv.api.baseUrl;

export const backStockPublicApi = edenTreaty<BackStockApiType>(API_URL);

export const backStockApi = backStockPublicApi;

/**
 * Eden's classic treaty models dynamic path segments as an index signature, so
 * `backStockApi.days[id]` is typed `Node | undefined` under noUncheckedIndexedAccess.
 * At runtime the treaty proxy always returns the node, so these accessors narrow
 * away the spurious `undefined` for path-param routes.
 */
type DayNode = NonNullable<(typeof backStockApi.days)[string]>;
type RunNode = NonNullable<(typeof backStockApi.runs)[string]>;

export const dayApi = (dayId: string): DayNode => backStockApi.days[dayId] as DayNode;
export const runApi = (runId: string): RunNode => backStockApi.runs[runId] as RunNode;

interface ErrorPayload {
  value: {
    error: string;
    message: string;
    request_id?: string;
    details?: { summary: string; message: string; path: string }[];
  };
}

export class ApiResponseError extends Error {
  readonly requestId?: string;
  readonly status?: number;
  readonly code?: string;
  constructor(message: string, requestId?: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiResponseError';
    this.requestId = requestId;
    this.status = status;
    this.code = code;
  }
}

type EdenResponse<T> = Promise<{ data: T; error: null } | { data: null; error: any }>;

function throwOnError(result: { error: unknown }): void {
  if (!result.error) return;
  const error = result.error as ErrorPayload & { status?: number };
  const status = error.status;
  const payload = error.value ?? ({} as Partial<ErrorPayload['value']>);
  let message = 'Something went wrong';
  if (payload.message) message = payload.message;
  if (payload.details?.[0]?.message) message = payload.details[0].message;
  throw new ApiResponseError(message, payload.request_id, status, payload.error);
}

/**
 * Generic API call wrapper for endpoints whose HTTP body IS the payload
 * (e.g. `/healthz`). Extracts errors, optionally parses with Zod.
 *
 * @example
 * const data = await apiCall<MyType>(() => backStockApi.healthz.get());
 */
export async function apiCall<T>(
  request: () => EdenResponse<unknown>,
  schema?: z.ZodType
): Promise<T> {
  const result = await request();
  throwOnError(result);
  if (schema) return schema.parse(result.data) as T;
  return result.data as T;
}

/**
 * Wrapper for domain endpoints that return the `{ data: ... }` envelope.
 * Unwraps the inner `data` so callers receive the typed payload directly.
 *
 * @example
 * const days = await apiData<DayListItem[]>(() => backStockApi.days.get());
 */
export async function apiData<T>(
  request: () => EdenResponse<{ data: T }>,
  schema?: z.ZodType
): Promise<T> {
  const result = await request();
  throwOnError(result);
  const payload = (result.data as { data: T }).data;
  if (schema) return schema.parse(payload) as T;
  return payload;
}
