import { $ } from 'bun';

$.env({ ...process.env, FORCE_COLOR: '1' });
const results = await Promise.allSettled([
  $`bun oxlint --type-aware --deny-warnings .`,
  $`bun run typecheck`,
]);
if (results.some((r) => r.status === 'rejected')) process.exit(1);
