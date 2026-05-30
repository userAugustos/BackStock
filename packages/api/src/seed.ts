import { and, eq } from 'drizzle-orm';

import { db } from '@api/db/client';
import { days } from '@api/db/schema';
import { insertDay, insertEvents } from '@api/modules/days/days.repository';
import { findRunsByDayId, insertRun } from '@api/modules/runs/runs.repository';
import { executeRun } from '@api/modules/runs/runs.worker';
import { findVersionByLabel, insertVersion } from '@api/modules/versions/versions.repository';
import type { CreateDayBody } from '@api/modules/days/days.schemas';
import type { CreateVersionBody } from '@api/modules/versions/versions.schemas';
import { LOG_DOMAINS, logger } from '@core/logger';

const seedLogger = logger.child({ domain: LOG_DOMAINS.SIM });

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

// Stub model id short-circuits the resolver to the deterministic stub, so the
// seed produces a real completed run without needing the LLM/RabbitMQ stack.
const BASELINE_VERSION: CreateVersionBody = {
  label: 'baseline',
  inventory_prompt_version: 'inv-v1',
  pricing_prompt_version: 'price-v1',
  model_id: 'stub',
};

/**
 * Seeds a single end-to-end example: one day, one version, one completed run.
 *
 * Idempotent — each step checks for existing rows before inserting. The run is
 * executed in-process via the stub resolver, so a clean boot lands the UI on a
 * day with a done run ready to replay.
 */
export async function seedExample() {
  const day = await ensureHeroDay();
  const version = await ensureBaselineVersion();
  await ensureOneCompletedRun(day.id, version.id);
}

async function ensureHeroDay() {
  const existing = await db
    .select()
    .from(days)
    .where(and(eq(days.name, HERO_DAY.name), eq(days.source, 'seed')))
    .then((rows) => rows[0]);
  if (existing) return existing;

  const dayRow = await insertDay({
    name: HERO_DAY.name,
    source: 'seed',
    seedState: HERO_DAY.seed_state,
    ignoredReport: null,
  });
  await insertEvents(dayRow.id, HERO_DAY.events);
  seedLogger.info('Seeded hero day', { id: dayRow.id, name: HERO_DAY.name });
  return dayRow;
}

async function ensureBaselineVersion() {
  const existing = await findVersionByLabel(BASELINE_VERSION.label);
  if (existing) return existing;

  const row = await insertVersion(BASELINE_VERSION);
  seedLogger.info('Seeded baseline version', { id: row.id, label: row.label });
  return row;
}

async function ensureOneCompletedRun(dayId: string, versionId: string) {
  const existing = await findRunsByDayId(dayId);
  if (existing.length > 0) return;

  const run = await insertRun({ dayId, versionId });
  await executeRun(run.id);
  seedLogger.info('Seeded baseline run', { id: run.id, day_id: dayId });
}
