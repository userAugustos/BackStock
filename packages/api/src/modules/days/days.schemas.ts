import { z } from 'zod';

export const SkuSchema = z.object({
  id: z.string().min(1),
  on_hand: z.number().int().nonnegative(),
  price: z.number().positive(),
  unit_cost: z.number().positive(),
  shelf_life_hours: z.number().positive(),
  case_size: z.number().int().positive(),
});

export const VendorSchema = z.object({
  id: z.string().min(1),
  lead_time_hours: z.number().positive(),
  next_delivery_at: z.string().min(1),
});

export const SeedStateSchema = z.object({
  skus: z.array(SkuSchema).min(1),
  vendors: z.array(VendorSchema).min(1),
});

export const EventInputSchema = z.object({
  seq: z.number().int().nonnegative(),
  at: z.string().min(1),
  type: z.string().min(1),
  payload: z.record(z.unknown()),
});

export const CreateDayBodySchema = z.object({
  name: z.string().min(1).max(200),
  seed_state: SeedStateSchema,
  events: z.array(EventInputSchema).min(1),
});

export const KNOWN_EVENT_TYPES = [
  'sales_spike',
  'vendor_delay',
  'damage_report',
  'invoice_cost_change',
  'promotion',
  'manager_override',
] as const;

export type Sku = z.infer<typeof SkuSchema>;
export type Vendor = z.infer<typeof VendorSchema>;
export type SeedState = z.infer<typeof SeedStateSchema>;
export type EventInput = z.infer<typeof EventInputSchema>;
export type CreateDayBody = z.infer<typeof CreateDayBodySchema>;
