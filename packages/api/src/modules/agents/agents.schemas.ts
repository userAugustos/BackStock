import { z } from 'zod';

// Guardrails that bound hallucinated LLM output to operationally sane values so a bad
// model response can never place an absurd order or set a runaway price.
const MAX_ORDER_CASES = 1000;
const MAX_PRICE_MULTIPLIER = 5;

/** Inventory agent response, bound to the day's catalog and a sane max order size. */
export function inventoryResponseSchema(catalogSkuIds: string[]) {
  return z.object({
    order_cases: z.number().int().nonnegative().max(MAX_ORDER_CASES),
    sku: z.enum(catalogSkuIds as [string, ...string[]]),
    summary: z.string().min(1),
  });
}

/** Pricing agent response, bound to the catalog and capped at MAX_PRICE_MULTIPLIER× the current price. */
export function pricingResponseSchema(
  catalogSkuIds: string[],
  currentPrices: Record<string, number>
) {
  return z
    .object({
      new_price: z.number().positive(),
      sku: z.enum(catalogSkuIds as [string, ...string[]]),
      summary: z.string().min(1),
    })
    .refine(
      (data) => {
        const current = currentPrices[data.sku];
        if (current === undefined) return false;
        return data.new_price <= current * MAX_PRICE_MULTIPLIER;
      },
      (data) => ({
        message: `new_price must not exceed ${MAX_PRICE_MULTIPLIER}x the current price for ${data.sku}`,
        path: ['new_price'],
      })
    );
}

export type InventoryResponse = z.infer<ReturnType<typeof inventoryResponseSchema>>;
export type PricingResponse = z.infer<ReturnType<typeof pricingResponseSchema>>;
