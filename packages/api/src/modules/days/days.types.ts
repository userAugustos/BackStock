import type { IgnoredEvent } from './days.normalizer';
import type { SeedState } from './days.schemas';

export type DaySource = 'seed' | 'upload';

export interface DayListItem {
  id: string;
  name: string;
  source: DaySource;
  sku_count: number;
  event_count: number;
  created_at: string;
}

export interface DayDetail {
  id: string;
  name: string;
  source: DaySource;
  seed_state: SeedState;
  sku_count: number;
  event_count: number;
  ignored_report: IgnoredEvent[] | null;
  created_at: string;
}

export interface DayEvent {
  id: string;
  seq: number;
  at: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface CreateDayResult {
  id: string;
  name: string;
  source: DaySource;
  sku_count: number;
  event_count: number;
  ignored_report: IgnoredEvent[] | null;
  created_at: string;
}
