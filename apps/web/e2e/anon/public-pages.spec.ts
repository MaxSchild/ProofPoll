import { expect, test } from '@playwright/test';

test.describe.parallel('Anonymous user public pages', () => {
  test('can access the home page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle('ProofPoll');
    await expect(page.getByText('Every answer, on the record.').first()).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /nobody records survey answers/i })
    ).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('link', { name: /get started/i })
    ).toBeVisible();
  });

  test('can access the login page', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL('/login');
    await expect(page.getByText('Sign in to ProofPoll')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    // Only email and password: no magic link or social sign-in.
    await expect(page.getByRole('tab')).toHaveCount(0);
  });

  test('can access the sign-up page', async ({ page }) => {
    await page.goto('/sign-up');

    await expect(page).toHaveURL('/sign-up');
    await expect(page.getByText('Create your ProofPoll account')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(0);
  });

  test('sees example searches on the verify page', async ({ page }) => {
    await page.goto('/verify');
    // The root layout adds the product name; pages must not repeat it.
    await expect(page).toHaveTitle('Verify a paper · ProofPoll');
    await expect(page.getByRole('heading', { name: 'Try an example' })).toBeVisible();
    await page.getByRole('link', { name: /Students will pay for reusable cups/ }).click();
    await expect(page).toHaveURL(/\/verify\?q=Students/);
    await expect(page.getByLabel('What do you know about the paper?')).toHaveValue(
      'Students will pay for reusable cups'
    );
    await expect(page.getByRole('heading', { name: 'Try an example' })).toHaveCount(0);
  });
});
