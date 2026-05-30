import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const SEED_DAY_NAME = 'Tue Mar 18 — milk crisis';

/** Open the seeded milk-crisis day detail screen from the index grid. */
export async function openSeedDay(page: Page) {
  await page.goto('/');
  await page.getByTestId('days-grid').getByText(SEED_DAY_NAME).click();
  await expect(page.getByTestId('day-detail')).toBeVisible();
}

/** Create a version via the day-detail dialog and wait for it to appear. */
export async function createVersion(page: Page, label: string) {
  await page.getByTestId('new-version-trigger').click();
  await expect(page.getByTestId('new-version-dialog')).toBeVisible();
  await page.getByTestId('version-label').fill(label);
  await page.getByTestId('new-version-submit').click();
  await expect(page.getByTestId('new-version-dialog')).toBeHidden();
  await expect(page.getByTestId('versions-panel').getByText(label)).toBeVisible();
}

/**
 * Run ids currently rendered in the tree, in DOM order. Run ids are UUIDs, so
 * only the `run-node-<uuid>` container matches — the `-link-`/`-status-`/`-compare-`
 * siblings are excluded by the hex-only id segment.
 */
export async function runNodeIds(page: Page): Promise<string[]> {
  const handles = await page
    .getByTestId('run-tree-graph')
    .locator('[data-testid^="run-node-"]')
    .all();
  const ids: string[] = [];
  for (const handle of handles) {
    const testid = await handle.getAttribute('data-testid');
    const match = testid?.match(/^run-node-([0-9a-f-]+)$/);
    if (match) ids.push(match[1]!);
  }
  return ids;
}

/**
 * Start a run for the given version and return the id of the run node that was
 * newly added to the tree. Scoping to the new node keeps assertions honest in a
 * persisted DB that may already hold runs (including completed ones from a prior
 * broker-enabled session).
 */
export async function startRunAndGetNewNodeId(page: Page, versionLabel: string): Promise<string> {
  const before = new Set(await runNodeIds(page));

  await page.getByTestId('start-run-version-select').click();
  await page.getByRole('option', { name: versionLabel }).click();
  await page.getByTestId('start-run-submit').click();

  let newId: string | undefined;
  await expect(async () => {
    const after = await runNodeIds(page);
    newId = after.find((id) => !before.has(id));
    expect(newId, 'a new run node should appear after starting a run').toBeDefined();
  }).toPass();

  return newId!;
}
