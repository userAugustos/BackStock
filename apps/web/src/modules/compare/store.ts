import { create } from 'zustand';

interface CompareState {
  runIds: Set<string>;
  add: (runId: string) => void;
  remove: (runId: string) => void;
  toggle: (runId: string) => void;
  clear: () => void;
}

const MAX_RUNS = 3;

export const useCompareStore = create<CompareState>((set) => ({
  runIds: new Set<string>(),
  add: (runId) =>
    set((state) => {
      if (state.runIds.has(runId) || state.runIds.size >= MAX_RUNS) return state;
      const next = new Set(state.runIds);
      next.add(runId);
      return { runIds: next };
    }),
  remove: (runId) =>
    set((state) => {
      if (!state.runIds.has(runId)) return state;
      const next = new Set(state.runIds);
      next.delete(runId);
      return { runIds: next };
    }),
  toggle: (runId) =>
    set((state) => {
      const next = new Set(state.runIds);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        if (next.size >= MAX_RUNS) return state;
        next.add(runId);
      }
      return { runIds: next };
    }),
  clear: () => set({ runIds: new Set<string>() }),
}));

export const COMPARE_MAX_RUNS = MAX_RUNS;
