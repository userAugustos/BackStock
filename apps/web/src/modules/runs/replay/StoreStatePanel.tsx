import { Banknote, Boxes, Coins, PackageX, Percent, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { RunTimelineStep } from '@back-stock/api/runs';
import type { SimState } from '@back-stock/api/simulation';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/shadcn/table';
import { formatCurrency, formatNumber } from '@/modules/core/lib/format';
import {
  buildStepSeries,
  computeStoreTotals,
  skuMarginRatio,
} from '@/modules/runs/replay/replay.derive';
import { StateSparklines } from '@/modules/runs/replay/StateSparklines';

interface StoreStatePanelProps {
  state: SimState;
  steps: RunTimelineStep[];
  currentStep: number;
}

interface ReadoutSpec {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'good' | 'warning' | 'danger' | 'default';
  testid: string;
}

export function StoreStatePanel({ state, steps, currentStep }: StoreStatePanelProps) {
  const totals = computeStoreTotals(state);
  const series = buildStepSeries(steps);
  const skus = Object.values(state.skus);

  const readouts: ReadoutSpec[] = [
    {
      label: 'inventory',
      value: `${formatNumber(totals.inventoryUnits)}`,
      icon: Boxes,
      testid: 'readout-inventory',
    },
    {
      label: 'margin',
      value: `${(totals.marginRatio * 100).toFixed(1)}%`,
      icon: Percent,
      tone: 'good',
      testid: 'readout-margin',
    },
    {
      label: 'revenue',
      value: formatCurrency(totals.revenue),
      icon: Banknote,
      testid: 'readout-revenue',
    },
    {
      label: 'waste',
      value: `${formatNumber(totals.wasteUnits)}`,
      icon: PackageX,
      tone: totals.wasteUnits > 0 ? 'warning' : 'default',
      testid: 'readout-waste',
    },
    {
      label: 'stockouts',
      value: `${formatNumber(totals.stockoutEvents)}`,
      icon: TrendingDown,
      tone: totals.stockoutEvents > 0 ? 'danger' : 'default',
      testid: 'readout-stockouts',
    },
    {
      label: 'missed rev',
      value: formatCurrency(totals.missedRevenue),
      icon: Coins,
      tone: totals.missedRevenue > 0 ? 'danger' : 'default',
      testid: 'readout-missed-revenue',
    },
  ];

  return (
    <div className="space-y-4" data-testid="store-state-panel">
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {readouts.map((readout) => (
          <Readout key={readout.label} {...readout} />
        ))}
      </dl>

      <StateSparklines series={series} currentStep={currentStep} />

      <div className="ring-foreground/[0.06] overflow-hidden rounded-xl ring-1">
        <Table data-testid="sku-state-table">
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Unit cost</TableHead>
              <TableHead className="text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skus.map((sku) => (
              <TableRow key={sku.sku_id} data-testid={`sku-state-row-${sku.sku_id}`}>
                <TableCell className="text-foreground font-mono text-sm font-medium">
                  {sku.sku_id}
                </TableCell>
                <TableCell className="text-foreground text-right font-mono text-sm tabular-nums">
                  {formatNumber(sku.on_hand)}
                </TableCell>
                <TableCell className="text-foreground text-right font-mono text-sm tabular-nums">
                  {formatCurrency(sku.price)}
                </TableCell>
                <TableCell className="text-foreground/80 text-right font-mono text-sm tabular-nums">
                  {formatCurrency(sku.unit_cost)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-[var(--good)] tabular-nums">
                  {(skuMarginRatio(sku) * 100).toFixed(0)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Readout({ label, value, icon: Icon, tone = 'default', testid }: ReadoutSpec) {
  const valueTone =
    tone === 'good'
      ? 'text-[var(--good)]'
      : tone === 'warning'
        ? 'text-[var(--warning)]'
        : tone === 'danger'
          ? 'text-[var(--danger)]'
          : 'text-foreground';

  return (
    <div
      data-testid={testid}
      className="bg-foreground/[0.03] ring-foreground/[0.06] rounded-xl px-3 py-2.5 ring-1"
    >
      <dt className="text-muted-foreground flex items-center gap-1.5 text-[10px] tracking-wider uppercase">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className={`mt-1 font-mono text-xl font-semibold tabular-nums ${valueTone}`}>{value}</dd>
    </div>
  );
}
