import { edenTreaty } from '@elysiajs/eden';

import type { BackStockApi } from '@back-stock/api/client';
import type { CompareResult, CompareResultSchema } from '@back-stock/api/compare';
import type { CreateDayBodySchema, DayDetail } from '@back-stock/api/days';
import type {
  BranchRunBodySchema,
  Run,
  RunDecision,
  RunImpact,
  RunTimelineStep,
  StartRunBodySchema,
} from '@back-stock/api/runs';
import type { SimState } from '@back-stock/api/simulation';
import type { CreateVersionBodySchema, Version } from '@back-stock/api/versions';

const _client = edenTreaty<BackStockApi>('http://localhost:3000');

// Forces actual type resolution so tree-shaking can't hide a broken bridge.
// If `BackStockApi` doesn't resolve, web typecheck fails here loudly and locally.
export type _HealthzReturn = Awaited<ReturnType<typeof _client.healthz.get>>;
export type _DaysSchemaCheck = typeof CreateDayBodySchema;
export type _RunsSchemaCheck = typeof StartRunBodySchema;
export type _BranchSchemaCheck = typeof BranchRunBodySchema;
export type _CompareSchemaCheck = typeof CompareResultSchema;
export type _VersionsSchemaCheck = typeof CreateVersionBodySchema;

export type _DayDetailCheck = DayDetail;
export type _VersionCheck = Version;
export type _RunCheck = Run;
export type _RunTimelineStepCheck = RunTimelineStep;
export type _RunImpactCheck = RunImpact;
export type _RunDecisionCheck = RunDecision;
export type _SimStateCheck = SimState;
export type _CompareResultCheck = CompareResult;
