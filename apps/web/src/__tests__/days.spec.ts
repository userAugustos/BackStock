import { expect, test } from '@playwright/test';

const SEED_DAY_NAME = 'Tue Mar 18 — milk crisis';

test.describe('@smoke days index', () => {
  test('loads the days grid with the seeded milk-crisis day and a healthy API', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByTestId('home')).toBeVisible();
    await expect(page.getByTestId('api-status')).toHaveText(/ok/);

    const grid = page.getByTestId('days-grid');
    await expect(grid).toBeVisible();
    await expect(grid.getByText(SEED_DAY_NAME)).toBeVisible();
  });

  test('rejects invalid JSON in the upload dialog and shows a validation error', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByTestId('upload-day-trigger').click();
    const dialog = page.getByTestId('upload-day-dialog');
    await expect(dialog).toBeVisible();

    await page.getByTestId('upload-day-input').fill('{ not valid json');
    await page.getByTestId('upload-day-submit').click();

    const fieldError = page.getByTestId('upload-day-error');
    await expect(fieldError).toBeVisible();
    await expect(fieldError).toHaveText(/Invalid JSON/);

    await page.getByTestId('upload-day-cancel').click();
    await expect(dialog).toBeHidden();
  });
});
