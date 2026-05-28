import { expect, test } from '@playwright/test';

import { createVersion, openSeedDay, startRunAndGetNewNodeId } from './helpers';

test.describe('@smoke compare', () => {
  test('shows the empty-state prompt when no runs are selected', async ({ page }) => {
    await page.goto('/compare');

    await expect(page.getByTestId('compare-empty-state')).toBeVisible();
    await expect(page.getByTestId('compare-empty-home-link')).toBeVisible();
    await expect(page.getByTestId('compare-screen')).toHaveCount(0);
  });

  test('selecting two run nodes enables Compare and navigates to /compare with both run ids', async ({
    page,
  }) => {
    await openSeedDay(page);

    const versionA = `cmp-a-${crypto.randomUUID().slice(0, 8)}`;
    const versionB = `cmp-b-${crypto.randomUUID().slice(0, 8)}`;
    await createVersion(page, versionA);
    await createVersion(page, versionB);

    const runA = await startRunAndGetNewNodeId(page, versionA);
    const runB = await startRunAndGetNewNodeId(page, versionB);

    await page.getByTestId(`run-node-compare-${runA}`).check();
    await page.getByTestId(`run-node-compare-${runB}`).check();

    const compareGo = page.getByTestId('run-tree-compare-go');
    await expect(compareGo).toBeEnabled();
    await compareGo.click();

    await expect(page).toHaveURL(/\/compare\?/);
    const url = new URL(page.url());
    const selected = [url.searchParams.get('run_a'), url.searchParams.get('run_b')];
    expect(selected).toContain(runA);
    expect(selected).toContain(runB);
  });

  // Requires the run-engine worker / RabbitMQ to produce two `done` runs; unskip when
  // the broker is available so /compare can render the scoreboard with real data.
  test.skip('renders the impact scoreboard for two completed runs of the same day', async ({
    page,
  }) => {
    // Preconditions (with a worker): both runs reach `done`, so /compare?run_a&run_b
    // resolves the compare query instead of erroring on `run_not_complete`.
    await page.goto('/compare?run_a=<done-run-a>&run_b=<done-run-b>');

    await expect(page.getByTestId('compare-screen')).toBeVisible();
    await expect(page.getByTestId('scoreboard-card')).toBeVisible();
    await expect(page.getByTestId('bar-chart-card')).toBeVisible();
    await expect(page.getByTestId('aligned-timeline-card')).toBeVisible();
  });
});
