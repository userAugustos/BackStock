import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { CompareResult } from '@back-stock/api/compare';

import { CHART_METRIC_KEYS, COMPARE_METRICS } from '@/modules/compare/compareMeta';
import { shortId } from '@/modules/core/lib/format';
import type { MetricDef } from '@/modules/compare/compareMeta';
import type { RunColor } from '@/modules/compare/runColors';

interface ImpactBarChartProps {
  result: CompareResult;
  colors: Map<string, RunColor>;
}

interface ChartRow {
  metric: string;
  metricKey: string;
  [runId: string]: number | string;
}

const CHART_METRICS: MetricDef[] = CHART_METRIC_KEYS.map(
  (key) => COMPARE_METRICS.find((m) => m.key === key)!
);

export function ImpactBarChart({ result, colors }: ImpactBarChartProps) {
  const runIds = result.runs.map((run) => run.run_id);

  const data: ChartRow[] = CHART_METRICS.map((metric) => {
    const row: ChartRow = { metric: metric.label, metricKey: metric.key };
    for (const runId of runIds) {
      row[runId] = result.impact.per_run[runId]?.[metric.key] ?? 0;
    }
    return row;
  });

  const formatByKey = new Map(CHART_METRICS.map((m) => [m.key, m.format]));

  return (
    <div className="h-64 w-full" data-testid="impact-bar-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="metric"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.25 }}
            content={<ChartTooltip formatByKey={formatByKey} />}
          />
          <Legend
            formatter={(value: string) => shortId(value)}
            wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
          />
          {runIds.map((runId) => (
            <Bar
              key={runId}
              dataKey={runId}
              name={runId}
              fill={colors.get(runId)?.cssVar}
              radius={[4, 4, 0, 0]}
              isAnimationActive
              animationDuration={400}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatByKey,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  formatByKey: Map<string, (value: number) => string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const metricKey = (payload[0] as unknown as { payload?: ChartRow }).payload?.metricKey ?? '';
  const format = formatByKey.get(metricKey) ?? ((v: number) => String(v));

  return (
    <div className="border-border bg-popover rounded-md border px-2.5 py-1.5 shadow-[var(--elevation-2)]">
      <p className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">{label}</p>
      <ul className="space-y-0.5">
        {payload.map((entry) => (
          <li
            key={entry.dataKey}
            className="flex items-center justify-between gap-3 font-mono text-[11px] tabular-nums"
          >
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{shortId(entry.dataKey)}</span>
            </span>
            <span className="text-foreground">{format(entry.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
