import { count, desc, eq } from 'drizzle-orm';

import { db } from '@api/db/client';
import { days, events } from '@api/db/schema';

import type { EventInput, SeedState } from './days.schemas';

export function findAllDays() {
  return db
    .select({
      id: days.id,
      name: days.name,
      source: days.source,
      seedState: days.seedState,
      ignoredReport: days.ignoredReport,
      createdAt: days.createdAt,
      eventCount: count(events.id),
    })
    .from(days)
    .leftJoin(events, eq(days.id, events.dayId))
    .groupBy(days.id)
    .orderBy(desc(days.createdAt));
}

export function findDayById(id: string) {
  return db
    .select({
      id: days.id,
      name: days.name,
      source: days.source,
      seedState: days.seedState,
      ignoredReport: days.ignoredReport,
      createdAt: days.createdAt,
      eventCount: count(events.id),
    })
    .from(days)
    .leftJoin(events, eq(days.id, events.dayId))
    .where(eq(days.id, id))
    .groupBy(days.id)
    .then((rows) => rows[0]);
}

interface InsertDayData {
  name: string;
  source: string;
  seedState: SeedState;
  ignoredReport: unknown[] | null;
}

export function insertDay(data: InsertDayData) {
  const id = crypto.randomUUID();
  return db
    .insert(days)
    .values({
      id,
      name: data.name,
      source: data.source,
      seedState: JSON.stringify(data.seedState),
      ignoredReport: data.ignoredReport ? JSON.stringify(data.ignoredReport) : null,
    })
    .returning()
    .then((rows) => rows[0]!);
}

export function insertEvents(dayId: string, eventInputs: EventInput[]) {
  if (eventInputs.length === 0) return Promise.resolve([]);
  return db
    .insert(events)
    .values(
      eventInputs.map((e) => ({
        id: crypto.randomUUID(),
        dayId,
        seq: e.seq,
        occurredAt: e.at,
        type: e.type,
        payload: JSON.stringify(e.payload),
      }))
    )
    .returning();
}

export function findEventsByDayId(dayId: string) {
  return db.select().from(events).where(eq(events.dayId, dayId)).orderBy(events.seq);
}
