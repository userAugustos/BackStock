import { expect, test } from '@playwright/test';

import { createVersion, openSeedDay, startRunAndGetNewNodeId } from './helpers';

test.describe('@smoke day detail', () => {
  test('renders catalog, full event stream, versions panel, and run tree', async ({ page }) => {
    await openSeedDay(page);

    await expect(page.getByTestId('catalog-table')).toBeVisible();
    await expect(page.getByTestId('catalog-row-milk-2pct-gal')).toBeVisible();
    await expect(page.getByTestId('catalog-row-produce-lettuce')).toBeVisible();

    const events = page.getByTestId('events-table');
    await expect(events).toBeVisible();
    for (let seq = 0; seq <= 5; seq++) {
      await expect(page.getByTestId(`event-row-${seq}`)).toBeVisible();
    }

    await expect(page.getByTestId('versions-panel')).toBeVisible();
    await expect(page.getByTestId('run-tree-panel')).toBeVisible();
  });

  test('creates a version and starts a run that appears queued (never done without a worker)', async ({
    page,
  }) => {
    await openSeedDay(page);

    const label = `qa-${crypto.randomUUID().slice(0, 8)}`;
    await createVersion(page, label);

    const runId = await startRunAndGetNewNodeId(page, label);

    await expect(page.getByTestId(`run-node-${runId}`)).toBeVisible();

    // The run-engine worker needs RabbitMQ, which is not running here, so the run
    // we just started stays queued (or briefly running) and must NOT reach done.
    // Scoped to this run's node — a persisted DB may legitimately hold older
    // completed runs from a prior broker-enabled session.
    const status = page.getByTestId(`run-node-status-${runId}`);
    await expect(status).toHaveAttribute('aria-label', /queued|running/);
    await expect(status).not.toHaveAttribute('aria-label', 'done');
  });
});
