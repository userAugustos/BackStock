import { $ } from 'bun';

$.env({ ...process.env, FORCE_COLOR: '1' });
const start = Date.now();
await $`bun run format`;
const results = await Promise.allSettled([
  $`bun oxlint --type-aware --deny-warnings --fix .`,
  $`bun run typecheck`,
]);
if (results.some((r) => r.status === 'rejected')) {
  console.error('One or more checks failed.');
  process.exit(1);
}
console.log(`Formatted in ${(Date.now() - start) / 1000}s`);
