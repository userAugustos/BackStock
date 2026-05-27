import { mkdirSync } from 'fs';
import { dirname } from 'path';

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

import { config } from '@core/env';

const url = config.database.url;
if (url !== ':memory:') mkdirSync(dirname(url), { recursive: true });

const sqlite = new Database(url, { create: true });

export const db = drizzle(sqlite);
