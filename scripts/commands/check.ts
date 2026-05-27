import { $ } from 'bun';

$.env({ ...process.env, FORCE_COLOR: '1' });
const start = Date.now();
const results = await Promise.allSettled([
  $`bun run format:check`,
  $`bun oxlint --type-aware --deny-warnings .`,
  $`bun run typecheck`,
]);
if (results.some((r) => r.status === 'rejected')) {
  console.error('One or more checks failed.');
  process.exit(1);
}
console.log(`Checks completed in ${(Date.now() - start) / 1000}s`);
