import { notFound } from '@core/errors';

import { normalizeDayEvents } from './days.normalizer';
import {
  findAllDays,
  findDayById,
  findEventsByDayId,
  insertDay,
  insertEvents,
} from './days.repository';
import type { CreateDayBody, SeedState } from './days.schemas';

function deserializeSeedState(raw: string): SeedState {
  return JSON.parse(raw) as SeedState;
}

export async function listDays() {
  const rows = await findAllDays();
  return rows.map((row) => {
    const seedState = deserializeSeedState(row.seedState);
    return {
      id: row.id,
      name: row.name,
      source: row.source,
      sku_count: seedState.skus.length,
      event_count: row.eventCount,
      created_at: row.createdAt,
    };
  });
}

export async function createDay(body: CreateDayBody) {
  const { accepted_events, ignored_report } = normalizeDayEvents(body.seed_state, body.events);

  const dayRow = await insertDay({
    name: body.name,
    source: 'upload',
    seedState: body.seed_state,
    ignoredReport: ignored_report,
  });

  await insertEvents(dayRow.id, accepted_events);

  return {
    id: dayRow.id,
    name: dayRow.name,
    source: dayRow.source,
    sku_count: body.seed_state.skus.length,
    event_count: accepted_events.length,
    ignored_report,
    created_at: dayRow.createdAt,
  };
}

export async function getDay(id: string) {
  const row = await findDayById(id);
  if (!row) {
    throw notFound('day_not_found', `Day '${id}' not found`);
  }
  const seedState = deserializeSeedState(row.seedState);
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    seed_state: seedState,
    sku_count: seedState.skus.length,
    event_count: row.eventCount,
    ignored_report: row.ignoredReport ? JSON.parse(row.ignoredReport) : null,
    created_at: row.createdAt,
  };
}

export async function getDayEvents(dayId: string) {
  const day = await findDayById(dayId);
  if (!day) {
    throw notFound('day_not_found', `Day '${dayId}' not found`);
  }
  const rows = await findEventsByDayId(dayId);
  return rows.map((row) => ({
    id: row.id,
    seq: row.seq,
    at: row.occurredAt,
    type: row.type,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
  }));
}
