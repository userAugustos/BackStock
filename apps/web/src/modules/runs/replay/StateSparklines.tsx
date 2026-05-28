import { Area, AreaChart, ReferenceDot, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { StepSeriesPoint } from '@/modules/runs/replay/replay.derive';

interface SparklineSpec {
  key: keyof Pick<StepSeriesPoint, 'inventoryUnits' | 'marginPct' | 'revenue'>;
  label: string;
  color: string;
  gradientId: string;
  testid: string;
}

const SPECS: SparklineSpec[] = [
  {
    key: 'inventoryUnits',
    label: 'inventory',
    color: 'var(--chart-1)',
    gradientId: 'spark-inv',
    testid: 'sparkline-inventory',
  },
  {
    key: 'marginPct',
    label: 'margin %',
    color: 'var(--chart-2)',
    gradientId: 'spark-margin',
    testid: 'sparkline-margin',
  },
  {
    key: 'revenue',
    label: 'revenue',
    color: 'var(--chart-4)',
    gradientId: 'spark-rev',
    testid: 'sparkline-revenue',
  },
];

interface StateSparklinesProps {
  series: StepSeriesPoint[];
  currentStep: number;
}

export function StateSparklines({ series, currentStep }: StateSparklinesProps) {
  return (
    <div className="grid grid-cols-3 gap-3" data-testid="state-sparklines">
      {SPECS.map((spec) => (
        <Sparkline key={spec.key} spec={spec} series={series} currentStep={currentStep} />
      ))}
    </div>
  );
}

function Sparkline({
  spec,
  series,
  currentStep,
}: {
  spec: SparklineSpec;
  series: StepSeriesPoint[];
  currentStep: number;
}) {
  const current = series.find((point) => point.step === currentStep);
  const currentValue = current ? current[spec.key] : 0;

  return (
    <div
      data-testid={spec.testid}
      className="bg-background/40 rounded-xl p-2.5 ring-1 ring-white/[0.05]"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
          {spec.label}
        </span>
      </div>
      <div className="h-10 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
            <defs>
              <linearGradient id={spec.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={spec.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={spec.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis hide dataKey="step" type="number" domain={['dataMin', 'dataMax']} />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Area
              type="monotone"
              dataKey={spec.key}
              stroke={spec.color}
              strokeWidth={1.5}
              fill={`url(#${spec.gradientId})`}
              isAnimationActive={false}
              dot={false}
            />
            <ReferenceDot
              x={currentStep}
              y={currentValue}
              r={3}
              fill={spec.color}
              stroke="var(--background)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
