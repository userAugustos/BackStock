import type {
  Decision,
  DecisionAgent,
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
  currentPrices: Record<string, number>;
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

function getSchemaForAgent(
  agent: DecisionAgent,
  catalogSkuIds: string[],
  currentPrices: Record<string, number>
) {
  if (agent === 'inventory') {
    return inventoryResponseSchema(catalogSkuIds);
  }
  return pricingResponseSchema(catalogSkuIds, currentPrices);
}

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

export function createLlmDecisionResolver(
  config: LlmResolverConfig
): (agent: DecisionAgent, context: SimState, event: SimEvent) => Promise<Decision> {
  const {
    client,
    catalogSkuIds,
    currentPrices,
    modelId,
    inventoryPromptVersion,
    pricingPromptVersion,
  } = config;

  return async (agent: DecisionAgent, context: SimState, event: SimEvent): Promise<Decision> => {
    return record(`agent.${agent}.resolve`, async () => {
      const skuId = extractSkuFromEvent(event);
      const promptVersion = agent === 'inventory' ? inventoryPromptVersion : pricingPromptVersion;
      const promptEntry = getPrompt(agent, promptVersion);

      if (!promptEntry) {
        agentLogger.warn('Prompt version not found, using safe default', {
          agent,
          prompt_version: promptVersion,
        });
        return safeDefault(agent, skuId, context);
      }

      const schema = getSchemaForAgent(agent, catalogSkuIds, currentPrices);
      const userMessage = buildUserMessage(agent, context, event);
      const messages: ChatMessage[] = [
        { role: 'system', content: promptEntry.system },
        { role: 'user', content: userMessage },
      ];

      const attemptParse = async (msgs: ChatMessage[]): Promise<Decision | null> => {
        try {
          const response = await client.chat({
            model: modelId,
            messages: msgs,
            temperature: 0.2,
            max_tokens: 512,
          });

          const choice = response.choices[0];
          if (!choice) {
            agentLogger.warn('LLM returned empty choices', { agent });
            return null;
          }

          const raw = parseContent(choice.message.content);
          const result = schema.safeParse(raw);

          if (!result.success) {
            agentLogger.warn('LLM response validation failed', {
              agent,
              errors: result.error.issues,
            });
            return null;
          }

          return parsedToDecision(agent, result.data as Record<string, unknown>);
        } catch (error) {
          agentLogger.error('LLM call failed', {
            agent,
            error: error instanceof Error ? error.message : String(error),
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
          content:
            'Your previous response was invalid. Please respond with ONLY a valid JSON object in the exact shape specified in the system prompt. No markdown, no extra text.',
        },
      ];

      const retryAttempt = await attemptParse(retryMessages);
      if (retryAttempt) return retryAttempt;

      agentLogger.warn('LLM failed after retry, using safe default', { agent, sku_id: skuId });
      return safeDefault(agent, skuId, context);
    }) as Promise<Decision>;
  };
}
