import { z } from 'zod';

import { CreateDayBodySchema } from '@back-stock/api/days';
import type { CreateDayBody } from '@back-stock/api/days';

export const uploadFormSchema = z
  .object({
    body: z.string().min(1, 'Paste a store-day JSON payload.'),
  })
  .transform((value, ctx): { body: CreateDayBody } => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value.body);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: 'Invalid JSON — check brackets, commas, and quotes.',
      });
      return z.NEVER;
    }

    const result = CreateDayBodySchema.safeParse(parsed);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['body'],
          message: `${issue.path.join('.') || 'payload'}: ${issue.message}`,
        });
      }
      return z.NEVER;
    }

    return { body: result.data };
  });

export type UploadFormInput = z.input<typeof uploadFormSchema>;
export type UploadFormOutput = z.output<typeof uploadFormSchema>;

export const EXAMPLE_DAY_JSON = JSON.stringify(
  {
    name: 'Sat Apr 05 — weekend rush',
    seed_state: {
      skus: [
        {
          id: 'eggs-dozen',
          on_hand: 40,
          price: 4.49,
          unit_cost: 2.9,
          shelf_life_hours: 240,
          case_size: 12,
        },
      ],
      vendors: [{ id: 'farm-fresh', lead_time_hours: 24, next_delivery_at: '09:00' }],
    },
    events: [
      { seq: 0, at: '08:30', type: 'sales_spike', payload: { sku: 'eggs-dozen', multiplier: 3 } },
      {
        seq: 1,
        at: '12:00',
        type: 'invoice_cost_change',
        payload: { sku: 'eggs-dozen', new_unit_cost: 3.2 },
      },
    ],
  },
  null,
  2
);
