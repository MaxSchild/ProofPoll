import { expect, type Page } from '@playwright/test';

/**
 * Signs up with email and password. Email confirmation is off (locally and
 * in production), so the new user lands on the dashboard straight away.
 */
export async function signupUserHelper({
  page,
  emailAddress,
  password = 'Password-123!',
}: {
  page: Page;
  emailAddress: string;
  password?: string;
}): Promise<void> {
  await page.goto('/sign-up');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email address').fill(emailAddress);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 30000 });
}
