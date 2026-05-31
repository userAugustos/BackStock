import { create } from 'zustand';

interface CompareState {
  runIds: Set<string>;
  /** The dayId scope of the current selection — selecting from another day is blocked. */
  dayId: string | null;
  toggle: (runId: string, dayId: string) => void;
  clear: () => void;
}

const MAX_RUNS = 4;

export const useCompareStore = create<CompareState>((set) => ({
  runIds: new Set<string>(),
  dayId: null,
  toggle: (runId, dayId) =>
    set((state) => {
      if (state.runIds.has(runId)) {
        const next = new Set(state.runIds);
        next.delete(runId);
        // Last selection removed → scope is free again.
        const nextDayId = next.size === 0 ? null : state.dayId;
        return { runIds: next, dayId: nextDayId };
      }
      // Cross-day add is silently rejected (UI disables the checkbox so this is a backstop).
      if (state.dayId !== null && state.dayId !== dayId) return state;
      if (state.runIds.size >= MAX_RUNS) return state;
      const next = new Set(state.runIds);
      next.add(runId);
      return { runIds: next, dayId: dayId };
    }),
  clear: () => set({ runIds: new Set<string>(), dayId: null }),
}));

export const COMPARE_MAX_RUNS = MAX_RUNS;
