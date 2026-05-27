import { expect, test } from '@playwright/test';

test('@smoke homepage loads and pings the API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(page.getByTestId('api-status')).toHaveText(/ok/);
});
