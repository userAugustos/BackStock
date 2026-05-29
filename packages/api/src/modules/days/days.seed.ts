import { and, eq } from 'drizzle-orm';

import { db } from '@api/db/client';
import { days } from '@api/db/schema';
import { logger } from '@core/logger';

import { insertDay, insertEvents } from './days.repository';
import type { CreateDayBody } from './days.schemas';

const HERO_DAY: CreateDayBody = {
  name: 'Tue Mar 18 — milk crisis',
  seed_state: {
    skus: [
      {
        id: 'milk-2pct-gal',
        on_hand: 30,
        price: 3.99,
        unit_cost: 2.8,
        shelf_life_hours: 96,
        case_size: 6,
      },
      {
        id: 'produce-lettuce',
        on_hand: 24,
        price: 1.99,
        unit_cost: 1.1,
        shelf_life_hours: 48,
        case_size: 12,
      },
    ],
    vendors: [
      {
        id: 'dairy-co',
        lead_time_hours: 18,
        next_delivery_at: '2026-03-18T10:00:00',
      },
    ],
  },
  events: [
    {
      seq: 0,
      at: '08:12',
      type: 'sales_spike',
      payload: { sku: 'milk-2pct-gal', multiplier: 2.5 },
    },
    { seq: 1, at: '09:03', type: 'vendor_delay', payload: { vendor: 'dairy-co', delay_hours: 6 } },
    { seq: 2, at: '10:20', type: 'damage_report', payload: { sku: 'produce-lettuce', units: 8 } },
    {
      seq: 3,
      at: '11:45',
      type: 'invoice_cost_change',
      payload: { sku: 'milk-2pct-gal', new_unit_cost: 3.1 },
    },
    {
      seq: 4,
      at: '14:10',
      type: 'promotion',
      payload: { sku: 'milk-2pct-gal', demand_multiplier: 1.8 },
    },
    {
      seq: 5,
      at: '17:30',
      type: 'manager_override',
      payload: { target: 'reorder', action: 'approve' },
    },
  ],
};

export async function seedHeroDay() {
  const existing = await db
    .select({ id: days.id })
    .from(days)
    .where(and(eq(days.name, HERO_DAY.name), eq(days.source, 'seed')))
    .then((rows) => rows[0]);

  if (existing) return;

  const dayRow = await insertDay({
    name: HERO_DAY.name,
    source: 'seed',
    seedState: HERO_DAY.seed_state,
    ignoredReport: null,
  });

  await insertEvents(dayRow.id, HERO_DAY.events);

  logger.info('Seeded hero day', { id: dayRow.id, name: HERO_DAY.name });
}
