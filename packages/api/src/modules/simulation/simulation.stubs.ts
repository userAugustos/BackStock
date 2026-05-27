import type {
  Decision,
  DecisionAgent,
  DecisionResolver,
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
): Decision => {
  const skuId = extractSkuFromEvent(event);
  const sku = context.skus[skuId]!;

  if (agent === 'inventory') {
    return {
      agent: 'inventory',
      sku_id: skuId,
      order_cases: 1,
      summary: 'Stub: order 1 case (minimum)',
    };
  }

  return {
    agent: 'pricing',
    sku_id: skuId,
    new_price: sku.price,
    summary: 'Stub: keep current price',
  };
};
