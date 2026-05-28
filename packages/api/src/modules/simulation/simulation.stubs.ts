import type {
  Decision,
  DecisionAgent,
  DecisionResolver,
  ResolvedDecision,
  SimEvent,
  SimState,
} from './simulation.types';

function extractSkuFromEvent(event: SimEvent): string {
  const payload = event.payload as unknown as Record<string, unknown>;
  return payload.sku as string;
}

export const stubDecisionResolver: DecisionResolver = (
  agent: DecisionAgent,
  context: SimState,
  event: SimEvent
): ResolvedDecision => {
  const skuId = extractSkuFromEvent(event);
  const sku = context.skus[skuId]!;
  let decision: Decision;

  if (agent === 'inventory') {
    decision = {
      agent: 'inventory',
      sku_id: skuId,
      order_cases: 1,
      summary: 'Stub: order 1 case (minimum)',
    };
  } else {
    decision = {
      agent: 'pricing',
      sku_id: skuId,
      new_price: sku.price,
      summary: 'Stub: keep current price',
    };
  }

  return {
    decision,
    raw_output: JSON.stringify(decision),
    source: 'stub',
    valid: true,
    latency_ms: 0,
  };
};
