import { test, expect } from '@playwright/test';

test.describe.parallel('Anonymous user gated page access', () => {
  test('is redirected from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
    await expect(page.getByText('Sign in to AllCounted')).toBeVisible();
  });
});
