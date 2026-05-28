import type { CompareRunMeta } from '@back-stock/api/compare';

export interface RunColor {
  /** CSS custom property reference, e.g. `var(--chart-1)`. */
  cssVar: string;
  /** Tailwind token name used in class strings. */
  token: string;
}

const PALETTE: RunColor[] = [
  { cssVar: 'var(--chart-1)', token: 'chart-1' },
  { cssVar: 'var(--chart-2)', token: 'chart-2' },
  { cssVar: 'var(--chart-3)', token: 'chart-3' },
];

/** Assign a stable chart color to each compared run by position (max 3). */
export function buildRunColors(runs: CompareRunMeta[]): Map<string, RunColor> {
  const map = new Map<string, RunColor>();
  runs.forEach((run, idx) => {
    map.set(run.run_id, PALETTE[idx % PALETTE.length]!);
  });
  return map;
}
