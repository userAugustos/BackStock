import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const days = sqliteTable('days', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  source: text('source').notNull(),
  seedState: text('seed_state').notNull(),
  ignoredReport: text('ignored_report'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const events = sqliteTable(
  'events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    dayId: text('day_id')
      .notNull()
      .references(() => days.id),
    seq: integer('seq').notNull(),
    occurredAt: text('occurred_at').notNull(),
    type: text('type').notNull(),
    payload: text('payload').notNull(),
  },
  (table) => ({
    daySeqIdx: uniqueIndex('events_day_seq_idx').on(table.dayId, table.seq),
  })
);

export const versions = sqliteTable('versions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  label: text('label').notNull().unique(),
  inventoryPromptVersion: text('inventory_prompt_version').notNull(),
  pricingPromptVersion: text('pricing_prompt_version').notNull(),
  modelId: text('model_id').notNull(),
  policy: text('policy'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const runs = sqliteTable('runs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  dayId: text('day_id')
    .notNull()
    .references(() => days.id),
  versionId: text('version_id')
    .notNull()
    .references(() => versions.id),
  parentRunId: text('parent_run_id').references((): AnySQLiteColumn => runs.id),
  forkEventSeq: integer('fork_event_seq'),
  forkChange: text('fork_change'),
  status: text('status').notNull().default('queued'),
  label: text('label'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
  completedAt: text('completed_at'),
});

export const decisions = sqliteTable(
  'decisions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text('run_id')
      .notNull()
      .references(() => runs.id),
    eventSeq: integer('event_seq').notNull(),
    agent: text('agent').notNull(),
    contextSnapshot: text('context_snapshot').notNull(),
    promptVersion: text('prompt_version').notNull(),
    modelId: text('model_id').notNull(),
    rawOutput: text('raw_output').notNull(),
    parsed: text('parsed').notNull(),
    reasoning: text('reasoning').notNull(),
    source: text('source').notNull(),
    valid: integer('valid').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    failureReason: text('failure_reason'),
  },
  (table) => ({
    runEventAgentIdx: uniqueIndex('decisions_run_event_agent_idx').on(
      table.runId,
      table.eventSeq,
      table.agent
    ),
  })
);

export const runSteps = sqliteTable(
  'run_steps',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text('run_id')
      .notNull()
      .references(() => runs.id),
    seq: integer('seq').notNull(),
    stateSnapshot: text('state_snapshot').notNull(),
    orderState: text('order_state').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => ({
    runSeqIdx: uniqueIndex('run_steps_run_seq_idx').on(table.runId, table.seq),
  })
);

export const impacts = sqliteTable('impacts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  runId: text('run_id')
    .notNull()
    .references(() => runs.id)
    .unique(),
  wastePct: real('waste_pct').notNull(),
  wasteValue: real('waste_value').notNull(),
  stockoutEvents: integer('stockout_events').notNull(),
  missedRevenue: real('missed_revenue').notNull(),
  endingMarginPct: real('ending_margin_pct').notNull(),
  endingInventoryValue: real('ending_inventory_value').notNull(),
  metrics: text('metrics'),
});

export const processedMessages = sqliteTable(
  'processed_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    subscriberId: text('subscriber_id').notNull(),
    messageId: text('message_id').notNull(),
    processedAt: text('processed_at')
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => ({
    subscriberMessageIdx: uniqueIndex('processed_messages_subscriber_message_idx').on(
      table.subscriberId,
      table.messageId
    ),
  })
);
