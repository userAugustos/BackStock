import type { Decision, DecisionAgent, SimState } from '@api/modules/simulation/simulation.types';

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
