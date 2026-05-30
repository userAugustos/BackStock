import { useQuery } from '@tanstack/react-query';
import { Brain, Flag, PlayCircle } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';

import type { DayEvent } from '@back-stock/api/days';

import { Skeleton } from '@repo/ui/shadcn/skeleton';
import { EmptyPanel } from '@/modules/core/StatePanels';
import { getEventMeta } from '@/modules/days/eventMeta';
import { DecisionCard } from '@/modules/runs/replay/DecisionCard';
import { runDecisionQueryOptions } from '@/modules/runs/runs.queries';

interface DecisionInspectorProps {
  runId: string;
  /** Timeline step the playhead sits on; the driving event is stepIndex - 1. */
  stepIndex: number;
  stepCount: number;
  events: DayEvent[];
  /** Event seqs that may carry a decision; gates the lookup to real candidates. */
  decisionPointSeqs: Set<number>;
}

export function DecisionInspector({
  runId,
  stepIndex,
  stepCount,
  events,
  decisionPointSeqs,
}: DecisionInspectorProps) {
  const eventSeq = stepIndex - 1;
  const isDecisionPoint = eventSeq >= 0 && decisionPointSeqs.has(eventSeq);
  const query = useQuery(runDecisionQueryOptions(runId, eventSeq, isDecisionPoint));

  if (query.isPending && isDecisionPoint) {
    return (
      <div data-testid="decision-inspector">
        <Skeleton className="h-48 w-full rounded-2xl" data-testid="decision-loading" />
      </div>
    );
  }

  if (query.data) {
    return (
      <div data-testid="decision-inspector">
        <AnimatePresence mode="wait">
          <DecisionCard key={query.data.event_seq} runId={runId} decision={query.data} />
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div data-testid="decision-inspector">
      <AnimatePresence mode="wait">
        <m.div
          key={`empty-${stepIndex}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <ContextualEmpty stepIndex={stepIndex} stepCount={stepCount} events={events} />
        </m.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Picks a panel that reflects where the playhead actually is — the previous panel
 * said "scrub to a decision" on every non-decision step, which read like nothing
 * had happened (especially at the end of the run, after the last event).
 */
function ContextualEmpty({
  stepIndex,
  stepCount,
  events,
}: {
  stepIndex: number;
  stepCount: number;
  events: DayEvent[];
}) {
  if (stepIndex === 0) {
    return (
      <EmptyPanel
        title="Start of day"
        message="08:00 — store open, agents idle until the first event."
        icon={<PlayCircle className="size-5" />}
        testid="decision-empty-start"
      />
    );
  }

  const isLast = stepIndex >= stepCount - 1;
  if (isLast) {
    return (
      <EmptyPanel
        title="Run complete"
        message="Day finished — all events replayed. Scrub left to revisit any agent call."
        icon={<Flag className="size-5" />}
        testid="decision-empty-end"
      />
    );
  }

  const driver = events.find((e) => e.seq === stepIndex - 1);
  if (driver) {
    const meta = getEventMeta(driver.type);
    return (
      <EmptyPanel
        title={`${meta.label} · ${driver.at}`}
        message="This event runs in the engine without an agent call. The next decision point is further along."
        icon={<Brain className="size-5" />}
        testid="decision-empty-passive"
      />
    );
  }

  return (
    <EmptyPanel
      title="No agent decision here"
      message="Scrub to a sales spike, promotion, or invoice change to inspect the agent's call."
      icon={<Brain className="size-5" />}
      testid="decision-empty"
    />
  );
}
