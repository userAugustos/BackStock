import type { Decision, DecisionAgent, SimState } from '@api/modules/simulation/simulation.types';

/**
 * No-op `Decision` recorded when the agent failed to decide (prompt missing, LLM timeout,
 * LLM http error, or invalid response after retry). Inventory: don't order. Pricing: keep
 * the current price. `summary` is empty because no reasoning happened — callers should
 * render the failure using the structured `failure_reason` on the ResolvedDecision instead
 * of a string field that would have to lie about the cause.
 */
export function failure(agent: DecisionAgent, skuId: string, state: SimState): Decision {
  if (agent === 'inventory') {
    return { agent: 'inventory', sku_id: skuId, order_cases: 0, summary: '' };
  }

  const currentPrice = state.skus[skuId]?.price ?? 0;
  return { agent: 'pricing', sku_id: skuId, new_price: currentPrice, summary: '' };
}
