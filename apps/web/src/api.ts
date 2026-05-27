import { edenTreaty } from '@elysiajs/eden';
import type { z } from 'zod';

import type { BackStockApi as BackStockApiType } from '@back-stock/api/client';

import { webEnv } from '@/modules/core/lib/env';

const API_URL = webEnv.api.baseUrl;

export const backStockPublicApi = edenTreaty<BackStockApiType>(API_URL);

export const backStockApi = backStockPublicApi;

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

/**
 * Generic API call wrapper. Extracts errors, optionally parses with Zod.
 *
 * @example
 * const data = await apiCall<MyType>(() => backStockApi.healthz.get());
 */
export async function apiCall<T>(
  request: () => EdenResponse<unknown>,
  schema?: z.ZodType
): Promise<T> {
  const result = await request();
  if (result.error) {
    const status = result.error.status as number | undefined;
    const error = result.error as ErrorPayload;
    const payload = error.value ?? ({} as Partial<ErrorPayload['value']>);
    let message = 'Something went wrong';
    if (payload.message) message = payload.message;
    if (payload.details?.[0]?.message) message = payload.details[0].message;
    throw new ApiResponseError(message, payload.request_id, status, payload.error);
  }
  if (schema) return schema.parse(result.data) as T;
  return result.data as T;
}
