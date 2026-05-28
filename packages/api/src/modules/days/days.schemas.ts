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
  next_delivery_at: z.string().datetime({ local: true }),
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

export const DayParamsSchema = z.object({
  id: z.string().min(1),
});

export const IgnoredEventSchema = z.object({
  original_seq: z.number().int().nonnegative(),
  type: z.string(),
  reason: z.string(),
});

export const DayListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  sku_count: z.number().int().nonnegative(),
  event_count: z.number().int().nonnegative(),
  created_at: z.string(),
});

export const DayDetailSchema = DayListItemSchema.extend({
  seed_state: SeedStateSchema,
  ignored_report: z.array(IgnoredEventSchema).nullable(),
});

export const CreateDayResponseSchema = DayListItemSchema.extend({
  ignored_report: z.array(IgnoredEventSchema).nullable(),
});

export const DayEventSchema = EventInputSchema.extend({
  id: z.string(),
});

export const DayListResponseSchema = z.object({ data: z.array(DayListItemSchema) });
export const CreateDayEnvelopeSchema = z.object({ data: CreateDayResponseSchema });
export const DayDetailResponseSchema = z.object({ data: DayDetailSchema });
export const DayEventsResponseSchema = z.object({ data: z.array(DayEventSchema) });

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
