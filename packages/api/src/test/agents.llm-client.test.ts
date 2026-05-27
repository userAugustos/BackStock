import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { createLlmClient } from '@api/modules/agents/agents.llm-client';
import type { LlmClient } from '@api/modules/agents/agents.types';

describe('createLlmClient', () => {
  let mockServer: ReturnType<typeof Bun.serve>;
  let client: LlmClient;

  beforeAll(() => {
    mockServer = Bun.serve({
      port: 19876,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === '/v1/chat/completions') {
          return Response.json({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '{"order_cases":5,"sku":"milk","summary":"test"}',
                },
                finish_reason: 'stop',
              },
            ],
          });
        }
        return new Response('Not found', { status: 404 });
      },
    });
    client = createLlmClient({
      url: 'http://localhost:19876',
      token: 'test-token',
      timeoutMs: 5000,
    });
  });

  afterAll(async () => {
    await mockServer.stop(true);
  });

  test('sends correct request and parses response', async () => {
    const response = await client.chat({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.2,
      max_tokens: 512,
    });
    expect(response.choices).toHaveLength(1);
    expect(response.choices[0]!.message.content).toBe(
      '{"order_cases":5,"sku":"milk","summary":"test"}'
    );
  });

  test('throws on non-200 response', async () => {
    const badClient = createLlmClient({
      url: 'http://localhost:19876/nonexistent',
      token: 'test-token',
      timeoutMs: 5000,
    });
    let threw = false;
    try {
      await badClient.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'hello' }],
        temperature: 0.2,
        max_tokens: 512,
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('throws on timeout', async () => {
    let slowServer: ReturnType<typeof Bun.serve> | undefined;
    try {
      slowServer = Bun.serve({
        port: 19877,
        async fetch() {
          await Bun.sleep(10_000);
          return Response.json({ choices: [] });
        },
      });
      const timeoutClient = createLlmClient({
        url: 'http://localhost:19877',
        token: 'test-token',
        timeoutMs: 100,
      });
      let threw = false;
      try {
        await timeoutClient.chat({
          model: 'test-model',
          messages: [{ role: 'user', content: 'hello' }],
          temperature: 0.2,
          max_tokens: 512,
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    } finally {
      void slowServer?.stop(true);
    }
  }, 15_000);
});
