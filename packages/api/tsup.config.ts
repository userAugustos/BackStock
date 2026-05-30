import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: {
    index: 'src/sdk/index.ts',
    client: 'src/sdk/client.ts',
    core: 'src/sdk/core.ts',
    days: 'src/sdk/days.ts',
    versions: 'src/sdk/versions.ts',
    runs: 'src/sdk/runs.ts',
    simulation: 'src/sdk/simulation.ts',
    compare: 'src/sdk/compare.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  clean: !options.watch,
  outDir: 'dist',
  external: ['zod'],
}));
