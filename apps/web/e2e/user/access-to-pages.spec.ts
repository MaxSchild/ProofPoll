import { test, expect } from '@playwright/test';

test.describe.parallel('Logged-in user page access', () => {
  test('can access dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Your polls' })
    ).toBeVisible();
  });

  test('can access home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', { name: /nobody records survey answers/i })
    ).toBeVisible();
  });
});
