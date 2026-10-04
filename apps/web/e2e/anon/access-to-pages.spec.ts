import { test, expect } from '@playwright/test';

test.describe.parallel('Anonymous user gated page access', () => {
  test('is redirected from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
    await expect(page.getByText('Sign in to ProofPoll')).toBeVisible();
  });

  test('is redirected from new poll to login', async ({ page }) => {
    await page.goto('/polls/new');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
    await expect(page.getByText('Sign in to ProofPoll')).toBeVisible();
  });

  test('is redirected from a poll page to login', async ({ page }) => {
    await page.goto('/polls/abcd1234');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('is redirected from papers to login', async ({ page }) => {
    await page.goto('/my-papers');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('sees nothing behind an unknown review link', async ({ page }) => {
    await page.goto('/review/abcdefghijklmnopqrstuvwx');
    await expect(page.getByText(/could not be found|not found/i).first()).toBeVisible();
  });

  test('can open the paper search', async ({ page }) => {
    await page.goto('/verify');
    await expect(page.getByRole('heading', { name: 'Verify a paper' })).toBeVisible();
    await page.getByLabel('What do you know about the paper?').fill('no such paper anywhere');
    await page.getByRole('button', { name: 'Find the paper' }).click();
    await expect(page.getByRole('heading', { name: 'No published paper found' })).toBeVisible();
  });
});
