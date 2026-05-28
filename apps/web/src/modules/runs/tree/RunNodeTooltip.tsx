import { useQuery } from '@tanstack/react-query';

import type { Run } from '@back-stock/api/runs';

import {
  formatCurrency,
  formatNumber,
  formatPercentPoints,
  shortId,
} from '@/modules/core/lib/format';
import { runImpactQueryOptions } from '@/modules/runs/runs.queries';
import { describeForkChange } from '@/modules/runs/tree/forkChange';

export function RunNodeTooltip({ run }: { run: Run }) {
  const isDone = run.status === 'done';
  const impactQuery = useQuery(runImpactQueryOptions(run.id, isDone));

  const isBranch = run.parent_run_id !== null;

  return (
    <div className="max-w-[15rem] space-y-2" data-testid={`run-node-tooltip-${run.id}`}>
      <div className="space-y-0.5">
        <p className="text-foreground font-mono text-xs font-medium">{shortId(run.id)}</p>
        {run.label ? <p className="text-muted-foreground text-[11px]">{run.label}</p> : null}
        {isBranch ? (
          <p className="text-muted-foreground text-[11px]">
            fork@{run.fork_event_seq} · {describeForkChange(run.fork_change)}
          </p>
        ) : (
          <p className="text-muted-foreground text-[11px]">root run · trunk</p>
        )}
      </div>

      {isDone ? (
        impactQuery.data ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/[0.08] pt-2 font-mono text-[11px] tabular-nums">
            <TooltipMetric label="waste" value={formatPercentPoints(impactQuery.data.waste_pct)} />
            <TooltipMetric
              label="stockouts"
              value={formatNumber(impactQuery.data.stockout_events)}
            />
            <TooltipMetric label="missed" value={formatCurrency(impactQuery.data.missed_revenue)} />
            <TooltipMetric
              label="margin"
              value={formatPercentPoints(impactQuery.data.ending_margin_pct)}
            />
          </dl>
        ) : (
          <p className="text-muted-foreground border-t border-white/[0.08] pt-2 text-[11px]">
            loading impact…
          </p>
        )
      ) : (
        <p className="text-muted-foreground border-t border-white/[0.08] pt-2 text-[11px]">
          impact available once the run is done
        </p>
      )}
    </div>
  );
}

function TooltipMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
