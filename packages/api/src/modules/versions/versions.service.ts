import { conflict, notFound } from '@core/errors';

import {
  findAllVersions,
  findVersionById,
  findVersionByLabel,
  insertVersion,
} from './versions.repository';
import type { CreateVersionBody } from './versions.schemas';

function deserializeVersion(row: {
  id: string;
  label: string;
  inventoryPromptVersion: string;
  pricingPromptVersion: string;
  modelId: string;
  policy: string | null;
  createdAt: string;
}) {
  return {
    id: row.id,
    label: row.label,
    inventory_prompt_version: row.inventoryPromptVersion,
    pricing_prompt_version: row.pricingPromptVersion,
    model_id: row.modelId,
    policy: row.policy ? (JSON.parse(row.policy) as Record<string, unknown>) : null,
    created_at: row.createdAt,
  };
}

export async function listVersions() {
  const rows = await findAllVersions();
  return rows.map(deserializeVersion);
}

export async function createVersion(body: CreateVersionBody) {
  const existing = await findVersionByLabel(body.label);
  if (existing) {
    throw conflict('version_label_exists', `Version label '${body.label}' already exists`);
  }
  const row = await insertVersion(body);
  return deserializeVersion(row);
}

export async function getVersion(id: string) {
  const row = await findVersionById(id);
  if (!row) {
    throw notFound('version_not_found', `Version '${id}' not found`);
  }
  return deserializeVersion(row);
}
