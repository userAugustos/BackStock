import type {
  DecisionAgent,
  DecisionResolver,
  ForkChange,
  ResolvedDecision,
  SimEvent,
  SimState,
} from '@api/modules/simulation/simulation.types';

interface ForkContext {
  parentDecisions: Map<number, ResolvedDecision>;
  forkEventSeq: number;
  forkChange: ForkChange;
  baseResolver: DecisionResolver;
}

export function createForkingResolver(ctx: ForkContext): DecisionResolver {
  const { parentDecisions, forkEventSeq, forkChange, baseResolver } = ctx;

  return (agent: DecisionAgent, state: SimState, event: SimEvent) => {
    if (event.seq < forkEventSeq) {
      const parentDecision = parentDecisions.get(event.seq);
      if (!parentDecision) {
        throw new Error(
          `No parent decision found for event seq ${event.seq} (fork at ${forkEventSeq})`
        );
      }
      return {
        decision: parentDecision.decision,
        raw_output: parentDecision.raw_output,
        source: 'reused' as const,
        valid: parentDecision.valid,
        latency_ms: 0,
      };
    }

    if (event.seq === forkEventSeq && forkChange.type === 'decision_override') {
      return {
        decision: forkChange.decision,
        raw_output: JSON.stringify(forkChange.decision),
        source: 'override' as const,
        valid: true,
        latency_ms: 0,
      };
    }

    return baseResolver(agent, state, event);
  };
}
