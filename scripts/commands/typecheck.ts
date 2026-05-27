import { $ } from 'bun';

$.env({ ...process.env, FORCE_COLOR: '1' });
const results = await Promise.allSettled([
  $`bun run --filter @back-stock/api typecheck`,
  $`bun run --filter web typecheck`,
]);
if (results.some((r) => r.status === 'rejected')) process.exit(1);
