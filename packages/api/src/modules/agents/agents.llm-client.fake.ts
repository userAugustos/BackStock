import type { LlmClient, LlmRequest, LlmResponse } from './agents.types';

interface FakeLlmClientOptions {
  response: string | ((request: LlmRequest) => string);
}

interface FakeLlmClientResult {
  client: LlmClient;
  calls: LlmRequest[];
}

export function createFakeLlmClient(options: FakeLlmClientOptions): FakeLlmClientResult {
  const calls: LlmRequest[] = [];

  const client: LlmClient = {
    async chat(request: LlmRequest): Promise<LlmResponse> {
      calls.push(structuredClone(request));
      const content =
        typeof options.response === 'function' ? options.response(request) : options.response;
      return {
        choices: [
          {
            message: { role: 'assistant', content },
            finish_reason: 'stop',
          },
        ],
      };
    },
  };

  return { client, calls };
}
