import { describe, expect, test } from 'bun:test';

import { createFakeLlmClient } from '@api/modules/agents/agents.llm-client.fake';

describe('createFakeLlmClient', () => {
  test('returns canned response', async () => {
    const fake = createFakeLlmClient({
      response: '{"order_cases":10,"sku":"milk-2pct-gal","summary":"fake"}',
    });
    const result = await fake.client.chat({
      model: 'test',
      messages: [{ role: 'user', content: 'test' }],
      temperature: 0,
      max_tokens: 100,
    });
    expect(result.choices[0]!.message.content).toBe(
      '{"order_cases":10,"sku":"milk-2pct-gal","summary":"fake"}'
    );
  });

  test('records calls', async () => {
    const fake = createFakeLlmClient({
      response: '{"order_cases":1,"sku":"x","summary":"y"}',
    });
    await fake.client.chat({
      model: 'model-a',
      messages: [{ role: 'system', content: 'sys' }],
      temperature: 0.1,
      max_tokens: 256,
    });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.model).toBe('model-a');
  });

  test('supports per-call responses via function', async () => {
    let callCount = 0;
    const fake = createFakeLlmClient({
      response: () => {
        callCount++;
        return `{"order_cases":${callCount},"sku":"x","summary":"call ${callCount}"}`;
      },
    });
    const r1 = await fake.client.chat({
      model: 'test',
      messages: [],
      temperature: 0,
      max_tokens: 100,
    });
    const r2 = await fake.client.chat({
      model: 'test',
      messages: [],
      temperature: 0,
      max_tokens: 100,
    });
    expect(r1.choices[0]!.message.content).toContain('"order_cases":1');
    expect(r2.choices[0]!.message.content).toContain('"order_cases":2');
  });
});
