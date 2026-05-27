import { record } from '@core/telemetry';

import type { LlmClient, LlmRequest, LlmResponse } from './agents.types';

interface LlmClientConfig {
  url: string;
  token: string;
  timeoutMs: number;
}

export function createLlmClient(cfg: LlmClientConfig): LlmClient {
  const endpoint = `${cfg.url}/v1/chat/completions`;

  return {
    async chat(request: LlmRequest): Promise<LlmResponse> {
      return record('llm.chat', async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (cfg.token) {
            headers['Authorization'] = `Bearer ${cfg.token}`;
          }

          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(request),
            signal: controller.signal,
          });

          if (!res.ok) {
            const body = await res.text().catch(() => 'no body');
            throw new Error(`LLM request failed: ${res.status} ${res.statusText} - ${body}`);
          }

          return (await res.json()) as LlmResponse;
        } finally {
          clearTimeout(timeout);
        }
      }) as Promise<LlmResponse>;
    },
  };
}
