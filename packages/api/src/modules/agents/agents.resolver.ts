import type {
  Decision,
  DecisionAgent,
  ResolvedDecision,
  SimEvent,
  SimState,
} from '@api/modules/simulation/simulation.types';
import { logger } from '@core/logger';
import { record } from '@core/telemetry';

import { safeDefault } from './agents.defaults';
import { getPrompt } from './agents.prompts';
import { inventoryResponseSchema, pricingResponseSchema } from './agents.schemas';
import type { ChatMessage, LlmClient } from './agents.types';

const agentLogger = logger.child({ domain: 'agents' });

interface LlmResolverConfig {
  client: LlmClient;
  catalogSkuIds: string[];
  modelId: string;
  inventoryPromptVersion: string;
  pricingPromptVersion: string;
}

function extractSkuFromEvent(event: SimEvent): string {
  const payload = event.payload as unknown as Record<string, unknown>;
  return (payload.sku as string) ?? '';
}

function buildUserMessage(agent: DecisionAgent, context: SimState, event: SimEvent): string {
  return JSON.stringify({
    agent_type: agent,
    current_time: context.current_time,
    store_state: {
      skus: context.skus,
      vendors: context.vendors,
      active_orders: context.orders.filter(
        (o) => o.status !== 'delivered' && o.status !== 'rejected' && o.status !== 'missed'
      ),
    },
    triggering_event: {
      seq: event.seq,
      at: event.at,
      type: event.type,
      payload: event.payload,
    },
  });
}

function getSchemaForAgent(agent: DecisionAgent, catalogSkuIds: string[], context: SimState) {
  if (agent === 'inventory') {
    return inventoryResponseSchema(catalogSkuIds);
  }
  const currentPrices = Object.fromEntries(
    Object.entries(context.skus).map(([skuId, sku]) => [skuId, sku.price])
  );
  return pricingResponseSchema(catalogSkuIds, currentPrices);
}

/**
 * Tolerates fenced LLM output: small models often wrap JSON in a ```json … ``` block,
 * so strip the fence (when present) before parsing.
 */
function parseContent(content: string): unknown {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const toParse = jsonMatch ? jsonMatch[1]!.trim() : trimmed;
  return JSON.parse(toParse);
}

function parsedToDecision(agent: DecisionAgent, parsed: Record<string, unknown>): Decision {
  if (agent === 'inventory') {
    return {
      agent: 'inventory',
      sku_id: parsed.sku as string,
      order_cases: parsed.order_cases as number,
      summary: parsed.summary as string,
    };
  }
  return {
    agent: 'pricing',
    sku_id: parsed.sku as string,
    new_price: parsed.new_price as number,
    summary: parsed.summary as string,
  };
}

/**
 * Builds the decision resolver the simulation calls at each decision point: prompt the
 * model, parse and validate against the day's catalog and guardrails, retry once feeding
 * the validation error back, and if it still fails fall back to a safe default recorded as
 * `valid: false` — never crash, always visible. A missing prompt version short-circuits to
 * the same fallback.
 */
export function createLlmDecisionResolver(
  config: LlmResolverConfig
): (agent: DecisionAgent, context: SimState, event: SimEvent) => Promise<ResolvedDecision> {
  const { client, catalogSkuIds, modelId, inventoryPromptVersion, pricingPromptVersion } = config;

  const resolveFallback = (
    agent: DecisionAgent,
    skuId: string,
    context: SimState,
    rawOutput: string,
    latencyMs: number
  ): ResolvedDecision => ({
    decision: safeDefault(agent, skuId, context),
    raw_output: rawOutput,
    source: 'llm',
    valid: false,
    latency_ms: latencyMs,
  });

  return async (
    agent: DecisionAgent,
    context: SimState,
    event: SimEvent
  ): Promise<ResolvedDecision> => {
    return record(`agent.${agent}.resolve`, async () => {
      const startedAt = performance.now();
      const skuId = extractSkuFromEvent(event);
      const promptVersion = agent === 'inventory' ? inventoryPromptVersion : pricingPromptVersion;
      const promptEntry = getPrompt(agent, promptVersion);

      if (!promptEntry) {
        agentLogger.warn('Prompt version not found, using safe default', {
          agent,
          prompt_version: promptVersion,
        });
        return resolveFallback(agent, skuId, context, '', 0);
      }

      const schema = getSchemaForAgent(agent, catalogSkuIds, context);
      const userMessage = buildUserMessage(agent, context, event);
      const messages: ChatMessage[] = [
        { role: 'system', content: promptEntry.system },
        { role: 'user', content: userMessage },
      ];
      let lastRawOutput = '';
      let lastError = 'unknown validation error';

      const attemptParse = async (msgs: ChatMessage[]): Promise<ResolvedDecision | null> => {
        try {
          const response = await client.chat({
            model: modelId,
            messages: msgs,
            temperature: 0.2,
            max_tokens: 512,
          });

          const choice = response.choices[0];
          if (!choice) {
            lastError = 'LLM returned empty choices';
            agentLogger.warn('LLM returned empty choices', { agent });
            return null;
          }

          lastRawOutput = choice.message.content;
          const raw = parseContent(lastRawOutput);
          const result = schema.safeParse(raw);

          if (!result.success) {
            lastError = JSON.stringify(result.error.issues);
            agentLogger.warn('LLM response validation failed', {
              agent,
              errors: result.error.issues,
            });
            return null;
          }

          const decision = parsedToDecision(agent, result.data as Record<string, unknown>);
          return {
            decision,
            raw_output: lastRawOutput,
            source: 'llm',
            valid: true,
            latency_ms: Math.round(performance.now() - startedAt),
          };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          agentLogger.error('LLM call failed', {
            agent,
            error: lastError,
          });
          return null;
        }
      };

      const firstAttempt = await attemptParse(messages);
      if (firstAttempt) return firstAttempt;

      const retryMessages: ChatMessage[] = [
        ...messages,
        {
          role: 'user',
          content: `Your previous response was invalid: ${lastError}. Please respond with ONLY a valid JSON object in the exact shape specified in the system prompt. No markdown, no extra text.`,
        },
      ];

      const retryAttempt = await attemptParse(retryMessages);
      if (retryAttempt) return retryAttempt;

      agentLogger.warn('LLM failed after retry, using safe default', { agent, sku_id: skuId });
      return resolveFallback(
        agent,
        skuId,
        context,
        lastRawOutput,
        Math.round(performance.now() - startedAt)
      );
    }) as Promise<ResolvedDecision>;
  };
}
