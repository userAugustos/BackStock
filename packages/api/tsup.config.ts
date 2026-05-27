import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: {
    index: 'src/sdk/index.ts',
    client: 'src/sdk/client.ts',
    core: 'src/sdk/core.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  clean: !options.watch,
  outDir: 'dist',
  external: ['zod'],
}));
