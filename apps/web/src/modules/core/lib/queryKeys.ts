export const queryKeys = {
  health: ['health'] as const,
  days: {
    all: ['days'] as const,
    detail: (dayId: string) => ['days', dayId] as const,
    events: (dayId: string) => ['days', dayId, 'events'] as const,
    runs: (dayId: string) => ['days', dayId, 'runs'] as const,
  },
  versions: {
    all: ['versions'] as const,
  },
  runs: {
    detail: (runId: string) => ['runs', runId] as const,
    timeline: (runId: string) => ['runs', runId, 'timeline'] as const,
    impact: (runId: string) => ['runs', runId, 'impact'] as const,
    decision: (runId: string, seq: number) => ['runs', runId, 'decisions', seq] as const,
  },
  compare: {
    runs: (runIds: readonly string[]) => ['compare', ...runIds] as const,
  },
} as const;
