import type { Decision, DecisionAgent, SimState } from '@api/modules/simulation/simulation.types';

/**
 * Safe fallback when LLM output can't be trusted after the retry: inventory places no
 * order, pricing keeps the current price. Recorded with `valid: false` so the fallback is
 * visible rather than silently applied.
 */
export function safeDefault(agent: DecisionAgent, skuId: string, state: SimState): Decision {
  if (agent === 'inventory') {
    return {
      agent: 'inventory',
      sku_id: skuId,
      order_cases: 0,
      summary: 'Fallback: LLM response invalid after retry; no order placed.',
    };
  }

  const currentPrice = state.skus[skuId]?.price ?? 0;
  return {
    agent: 'pricing',
    sku_id: skuId,
    new_price: currentPrice,
    summary: 'Fallback: LLM response invalid after retry; price unchanged.',
  };
}
