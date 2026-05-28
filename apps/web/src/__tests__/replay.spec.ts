import { expect, test } from '@playwright/test';

import { createVersion, openSeedDay, startRunAndGetNewNodeId } from './helpers';

test.describe('@smoke replay', () => {
  test('a queued run renders the executing state, not a fabricated timeline', async ({ page }) => {
    await openSeedDay(page);

    const label = `replay-${crypto.randomUUID().slice(0, 8)}`;
    await createVersion(page, label);
    const runId = await startRunAndGetNewNodeId(page, label);

    await page.getByTestId(`run-node-link-${runId}`).click();
    await expect(page).toHaveURL(new RegExp(`/runs/${runId}`));

    // No worker (no RabbitMQ) -> stays queued: assert the honest executing state,
    // and that the data-bearing replay screen / timeline is NOT shown.
    await expect(page.getByTestId('replay-executing')).toBeVisible();
    await expect(page.getByTestId('replay-executing-queued')).toBeVisible();
    await expect(page.getByTestId('replay-screen')).toHaveCount(0);
    await expect(page.getByTestId('replay-timeline')).toHaveCount(0);
  });

  // Requires the run-engine worker / RabbitMQ to produce a `done` run; unskip when
  // the broker is available so a started run can complete and populate the timeline.
  test.skip('scrubbing a completed run advances the timeline step readout', async ({ page }) => {
    // Preconditions (with a worker): a run reaches `done`, so /runs/$runId renders
    // <ReplayScreen> with the flight recorder.
    await expect(page.getByTestId('replay-screen')).toBeVisible();
    await expect(page.getByTestId('replay-timeline')).toBeVisible();

    const scrubber = page.getByTestId('timeline-scrubber');
    const readout = page.getByTestId('timeline-step-readout');
    await expect(readout).toHaveText('0');

    await scrubber.focus();
    await page.keyboard.press('ArrowRight');
    await expect(readout).not.toHaveText('0');
  });
});
