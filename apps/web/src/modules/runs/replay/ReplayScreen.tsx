import { Activity, Boxes, Brain, GaugeCircle, Truck } from 'lucide-react';
import { motion } from 'motion/react';

import type { DayEvent } from '@back-stock/api/days';
import type { Run, RunImpact, RunTimelineStep } from '@back-stock/api/runs';

import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/shadcn/card';
import { formatCurrency, formatPercentPoints } from '@/modules/core/lib/format';
import { staggerContainer, staggerItem } from '@/modules/core/lib/motion';
import { DecisionInspector } from '@/modules/runs/replay/DecisionInspector';
import { OrderTrack } from '@/modules/runs/replay/OrderTrack';
import { buildDecisionPointSeqs, buildEventMarkers } from '@/modules/runs/replay/replay.derive';
import { ReplayHeader } from '@/modules/runs/replay/ReplayHeader';
import { StoreStatePanel } from '@/modules/runs/replay/StoreStatePanel';
import { Timeline } from '@/modules/runs/replay/Timeline';
import { usePlayback, usePlaybackLoop } from '@/modules/runs/replay/usePlayback';

interface ReplayScreenProps {
  run: Run;
  timeline: RunTimelineStep[];
  impact: RunImpact;
  events: DayEvent[];
}

export function ReplayScreen({ run, timeline, impact, events }: ReplayScreenProps) {
  const [playback, dispatch] = usePlayback(timeline.length);
  usePlaybackLoop(playback, dispatch);

  const markers = buildEventMarkers(events);
  const decisionPointSeqs = buildDecisionPointSeqs(events);
  const currentStep = timeline[playback.index] ?? timeline[0]!;

  return (
    <motion.div
      data-testid="replay-screen"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={staggerItem}>
        <ReplayHeader run={run} />
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card data-testid="timeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="text-primary size-4" />
              Flight recorder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              state={playback}
              dispatch={dispatch}
              stepCount={timeline.length}
              markers={markers}
            />
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-6">
          <motion.div variants={staggerItem}>
            <Card data-testid="store-state-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Boxes className="text-primary size-4" />
                  Store state
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StoreStatePanel
                  state={currentStep.state_snapshot}
                  steps={timeline}
                  currentStep={currentStep.seq}
                />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card data-testid="order-track-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="text-primary size-4" />
                  Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OrderTrack orders={currentStep.order_state} />
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div variants={staggerItem}>
            <Card data-testid="impact-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GaugeCircle className="text-primary size-4" />
                  Run impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ImpactSummary impact={impact} />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card data-testid="decision-card-wrapper">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="text-primary size-4" />
                  Agent decision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DecisionInspector
                  runId={run.id}
                  stepIndex={playback.index}
                  decisionPointSeqs={decisionPointSeqs}
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function ImpactSummary({ impact }: { impact: RunImpact }) {
  const rows: { label: string; value: string; testid: string }[] = [
    {
      label: 'ending margin',
      value: formatPercentPoints(impact.ending_margin_pct),
      testid: 'impact-margin',
    },
    {
      label: 'ending inventory',
      value: formatCurrency(impact.ending_inventory_value),
      testid: 'impact-inventory-value',
    },
    {
      label: 'waste',
      value: `${formatPercentPoints(impact.waste_pct)} · ${formatCurrency(impact.waste_value)}`,
      testid: 'impact-waste',
    },
    {
      label: 'stockouts',
      value: `${impact.stockout_events}`,
      testid: 'impact-stockouts',
    },
    {
      label: 'missed revenue',
      value: formatCurrency(impact.missed_revenue),
      testid: 'impact-missed-revenue',
    },
  ];

  return (
    <dl data-testid="impact-summary" className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0"
        >
          <dt className="text-muted-foreground text-sm">{row.label}</dt>
          <dd
            data-testid={row.testid}
            className="text-foreground font-mono text-sm font-medium tabular-nums"
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
