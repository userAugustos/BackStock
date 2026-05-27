import { badRequest } from '@core/errors';

import { KNOWN_EVENT_TYPES } from './days.schemas';
import type { EventInput, SeedState } from './days.schemas';

export interface IgnoredEvent {
  original_seq: number;
  type: string;
  reason: string;
}

export interface NormalizeResult {
  accepted_events: EventInput[];
  ignored_report: IgnoredEvent[] | null;
}

export function normalizeDayEvents(seedState: SeedState, rawEvents: EventInput[]): NormalizeResult {
  const knownSkuIds = new Set(seedState.skus.map((s) => s.id));
  const knownVendorIds = new Set(seedState.vendors.map((v) => v.id));

  const sorted = [...rawEvents].sort((a, b) => a.seq - b.seq);

  const seenSeqs = new Set<number>();
  for (const event of sorted) {
    if (seenSeqs.has(event.seq)) {
      throw badRequest('duplicate_event_seq', `Duplicate event seq: ${event.seq}`);
    }
    seenSeqs.add(event.seq);
  }

  const accepted: EventInput[] = [];
  const ignored: IgnoredEvent[] = [];

  for (const event of sorted) {
    const knownType = (KNOWN_EVENT_TYPES as readonly string[]).includes(event.type);
    if (!knownType) {
      ignored.push({
        original_seq: event.seq,
        type: event.type,
        reason: 'unknown_event_type',
      });
      continue;
    }

    const payloadSku = event.payload.sku as string | undefined;
    if (payloadSku && !knownSkuIds.has(payloadSku)) {
      ignored.push({
        original_seq: event.seq,
        type: event.type,
        reason: 'unknown_sku',
      });
      continue;
    }

    const payloadVendor = event.payload.vendor as string | undefined;
    if (payloadVendor && !knownVendorIds.has(payloadVendor)) {
      ignored.push({
        original_seq: event.seq,
        type: event.type,
        reason: 'unknown_vendor',
      });
      continue;
    }

    accepted.push(event);
  }

  if (accepted.length === 0) {
    throw badRequest('all_events_ignored', 'All events were ignored during normalization');
  }

  const renumbered = accepted.map((event, idx) => ({
    ...event,
    seq: idx,
  }));

  return {
    accepted_events: renumbered,
    ignored_report: ignored.length > 0 ? ignored : null,
  };
}
