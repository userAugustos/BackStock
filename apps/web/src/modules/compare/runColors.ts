import type { CompareRunMeta } from '@back-stock/api/compare';

export interface RunColor {
  /** CSS custom property reference, e.g. `var(--chart-1)`. */
  cssVar: string;
  /** Tailwind token name used in class strings. */
  token: string;
}

/* Distinct hues per slot so 2–4 runs read at a glance in chart legends and
   timeline columns. Sequential chart tokens (chart-1..3) share a hue family
   in the base palette, which makes side-by-side runs hard to distinguish. */
const PALETTE: RunColor[] = [
  { cssVar: 'var(--info)', token: 'info' },
  { cssVar: 'var(--primary)', token: 'primary' },
  { cssVar: 'var(--warning)', token: 'warning' },
  { cssVar: 'var(--good)', token: 'good' },
];

/** Assign a stable chart color to each compared run by position (max 4). */
export function buildRunColors(runs: CompareRunMeta[]): Map<string, RunColor> {
  const map = new Map<string, RunColor>();
  runs.forEach((run, idx) => {
    map.set(run.run_id, PALETTE[idx % PALETTE.length]!);
  });
  return map;
}
