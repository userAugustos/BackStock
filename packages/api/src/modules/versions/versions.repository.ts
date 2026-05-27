import { desc, eq } from 'drizzle-orm';

import { db } from '@api/db/client';
import { versions } from '@api/db/schema';

import type { CreateVersionBody } from './versions.schemas';

export function findAllVersions() {
  return db.select().from(versions).orderBy(desc(versions.createdAt));
}

export function findVersionById(id: string) {
  return db
    .select()
    .from(versions)
    .where(eq(versions.id, id))
    .then((rows) => rows[0]);
}

export function findVersionByLabel(label: string) {
  return db
    .select()
    .from(versions)
    .where(eq(versions.label, label))
    .then((rows) => rows[0]);
}

export function insertVersion(data: CreateVersionBody) {
  const id = crypto.randomUUID();
  return db
    .insert(versions)
    .values({
      id,
      label: data.label,
      inventoryPromptVersion: data.inventory_prompt_version,
      pricingPromptVersion: data.pricing_prompt_version,
      modelId: data.model_id,
      policy: data.policy ? JSON.stringify(data.policy) : null,
    })
    .returning()
    .then((rows) => rows[0]!);
}
