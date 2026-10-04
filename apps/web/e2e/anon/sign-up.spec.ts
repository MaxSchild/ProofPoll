import { expect, test } from '@playwright/test';

// Without email confirmation (local and production), signing up with a
// password signs the user in, so they must land on the dashboard rather than
// wait for an email that never comes.
test.describe('Anonymous user signs up', () => {
  test('with a password and goes straight to the dashboard', async ({ page }) => {
    await page.goto('/sign-up');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Email address').fill(`signup-${Date.now()}@example.com`);
    await page.getByLabel('Password').fill('Password-123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByText('Confirmation Link Sent')).toHaveCount(0);
  });
});
