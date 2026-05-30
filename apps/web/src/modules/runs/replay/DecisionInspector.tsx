import { useQuery } from '@tanstack/react-query';
import { Brain } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';

import { Skeleton } from '@repo/ui/shadcn/skeleton';
import { EmptyPanel } from '@/modules/core/StatePanels';
import { DecisionCard } from '@/modules/runs/replay/DecisionCard';
import { runDecisionQueryOptions } from '@/modules/runs/runs.queries';

interface DecisionInspectorProps {
  runId: string;
  /** Timeline step the playhead sits on; the driving event is stepIndex - 1. */
  stepIndex: number;
  /** Event seqs that may carry a decision; gates the lookup to real candidates. */
  decisionPointSeqs: Set<number>;
}

export function DecisionInspector({ runId, stepIndex, decisionPointSeqs }: DecisionInspectorProps) {
  const eventSeq = stepIndex - 1;
  const enabled = eventSeq >= 0 && decisionPointSeqs.has(eventSeq);
  const query = useQuery(runDecisionQueryOptions(runId, eventSeq, enabled));

  return (
    <div data-testid="decision-inspector">
      {query.isPending && enabled ? (
        <Skeleton className="h-48 w-full rounded-2xl" data-testid="decision-loading" />
      ) : query.data ? (
        <AnimatePresence mode="wait">
          <DecisionCard key={query.data.event_seq} runId={runId} decision={query.data} />
        </AnimatePresence>
      ) : (
        <AnimatePresence mode="wait">
          <m.div
            key="no-decision"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <EmptyPanel
              title="No agent decision here"
              message="Scrub to a sales spike, promotion, or invoice change to inspect the agent's call."
              icon={<Brain className="size-5" />}
              testid="decision-empty"
            />
          </m.div>
        </AnimatePresence>
      )}
    </div>
  );
}
