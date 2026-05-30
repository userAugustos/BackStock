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

/**
 * Wraps a base resolver with the fork rule, applied per event seq:
 *   - before the fork → reuse the parent run's recorded decision (source: 'reused', no LLM call)
 *   - at the fork, when `forkChange.type === 'decision_override'` → return the override (source: 'override')
 *   - at the fork (version) or after the fork → delegate to the base resolver (LLM or stub)
 * Pre-fork reuse is what makes a counterfactual branch deterministic up to the fork
 * point; a version fork (fork at seq 0) reuses nothing and recomputes the whole day.
 */
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
        failure_reason: parentDecision.failure_reason,
        prompt_version: parentDecision.prompt_version,
        model_id: parentDecision.model_id,
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
