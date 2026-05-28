import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { motion } from 'motion/react';

import type { CompareResult, ImpactDelta, ImpactValues } from '@back-stock/api/compare';

import { cn } from '@repo/ui/utils';
import { COMPARE_METRICS, deltaTone } from '@/modules/compare/compareMeta';
import { shortId } from '@/modules/core/lib/format';
import { staggerContainer, staggerItem } from '@/modules/core/lib/motion';
import type { DeltaTone, MetricDef } from '@/modules/compare/compareMeta';
import type { RunColor } from '@/modules/compare/runColors';

interface ImpactScoreboardProps {
  result: CompareResult;
  colors: Map<string, RunColor>;
}

export function ImpactScoreboard({ result, colors }: ImpactScoreboardProps) {
  const runIds = result.runs.map((run) => run.run_id);

  return (
    <motion.div
      data-testid="impact-scoreboard"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {COMPARE_METRICS.map((metric) => (
        <MetricCard
          key={metric.key}
          metric={metric}
          runIds={runIds}
          perRun={result.impact.per_run}
          deltas={result.impact.deltas}
          colors={colors}
        />
      ))}
    </motion.div>
  );
}

interface MetricCardProps {
  metric: MetricDef;
  runIds: string[];
  perRun: Record<string, ImpactValues>;
  deltas: ImpactDelta[];
  colors: Map<string, RunColor>;
}

function MetricCard({ metric, runIds, perRun, deltas, colors }: MetricCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      data-testid={`scoreboard-metric-${metric.testid}`}
      className="bg-card rounded-2xl p-4 shadow-[var(--elevation-1)] ring-1 ring-white/[0.06]"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          {metric.label}
        </h3>
        {metric.better !== 'neutral' ? (
          <span className="text-muted-foreground/60 text-[10px]">
            {metric.better === 'lower' ? 'lower is better' : 'higher is better'}
          </span>
        ) : null}
      </div>

      <dl className="mt-3 space-y-2">
        {runIds.map((runId) => {
          const color = colors.get(runId);
          return (
            <div key={runId} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 font-mono text-xs">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: color?.cssVar }}
                />
                <span className="text-muted-foreground">{shortId(runId)}</span>
              </dt>
              <dd
                data-testid={`scoreboard-value-${metric.testid}-${runId}`}
                className="text-foreground font-mono text-sm font-medium tabular-nums"
              >
                {metric.format(perRun[runId]?.[metric.key] ?? 0)}
              </dd>
            </div>
          );
        })}
      </dl>

      {deltas.length > 0 ? (
        <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
          {deltas.map((delta) => {
            const value = delta[metric.key];
            const tone = deltaTone(value, metric.better);
            return (
              <DeltaRow
                key={`${metric.key}-${delta.pair[0]}-${delta.pair[1]}`}
                pair={delta.pair}
                value={value}
                tone={tone}
                format={metric.format}
                testid={`scoreboard-delta-${metric.testid}-${delta.pair[0]}-${delta.pair[1]}`}
              />
            );
          })}
        </div>
      ) : null}
    </motion.div>
  );
}

const TONE_CLASS: Record<DeltaTone, string> = {
  good: 'text-[var(--good)]',
  bad: 'text-[var(--danger)]',
  neutral: 'text-muted-foreground',
};

function DeltaRow({
  pair,
  value,
  tone,
  format,
  testid,
}: {
  pair: [string, string];
  value: number;
  tone: DeltaTone;
  format: (value: number) => string;
  testid: string;
}) {
  const Arrow = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  const sign = value > 0 ? '+' : '';
  return (
    <div
      data-testid={testid}
      data-tone={tone}
      className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums"
    >
      <span className="text-muted-foreground/70">
        {shortId(pair[0])} → {shortId(pair[1])}
      </span>
      <span className={cn('inline-flex items-center gap-1 font-medium', TONE_CLASS[tone])}>
        <motion.span
          initial={{ y: value === 0 ? 0 : value > 0 ? 3 : -3, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
        >
          <Arrow className="size-3" />
        </motion.span>
        {sign}
        {format(value)}
      </span>
    </div>
  );
}
