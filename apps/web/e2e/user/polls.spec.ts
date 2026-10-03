import { expect, test, type Page } from '@playwright/test';

import { signupUserHelper } from '../_helpers/signup.helper';

async function createPoll(page: Page, title: string, withAttentionCheck: boolean) {
  await page.goto('/polls/new');
  await page.getByLabel('Title *').fill(title);
  await page.getByLabel('Planned participants').fill('50');

  await page.getByLabel('Question 1 text').fill('Coffee or tea?');
  await page.getByRole('textbox', { name: 'Option 1 of question 1' }).fill('Coffee');
  await page.getByRole('textbox', { name: 'Option 2 of question 1' }).fill('Tea');

  await page.getByRole('button', { name: 'Add question' }).click();
  await page.getByLabel('Question 2 text').fill('Please select "Yes"');
  await page.getByRole('textbox', { name: 'Option 1 of question 2' }).fill('No');
  await page.getByRole('textbox', { name: 'Option 2 of question 2' }).fill('Yes');

  if (withAttentionCheck) {
    await page.getByLabel('Use as attention check').nth(1).check();
    await page.getByRole('radio', { name: 'Option 2 is the correct answer' }).check();
  }

  await page.getByRole('button', { name: 'Save as draft' }).click();
  await expect(page).toHaveURL(/\/polls\/[A-Za-z0-9]{8}$/);
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
}

test.describe('Logged-in user polls', () => {
  test('creates, edits, opens and closes a poll', async ({ page }) => {
    const title = `Coffee habits ${Date.now()}`;
    await createPoll(page, title, true);

    // Draft: plan and attention check are shown.
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Attention check, correct: Yes')).toBeVisible();
    await expect(page.getByText('Coffee or tea?')).toBeVisible();
    await expect(page.getByText('0 / 50')).toBeVisible();

    // It appears on the dashboard as a draft.
    await page.goto('/dashboard');
    const row = page.getByRole('row').filter({ hasText: title });
    await expect(row.getByText('Draft')).toBeVisible();
    await row.getByRole('link', { name: title }).click();

    // Edit the title; the attention check survives the save.
    await page.getByRole('link', { name: 'Edit' }).click();
    const newTitle = `${title} (edited)`;
    await page.getByLabel('Title *').fill(newTitle);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: newTitle, level: 1 })).toBeVisible();
    await expect(page.getByText('Attention check, correct: Yes')).toBeVisible();

    // Open, behind a confirmation.
    await page.getByRole('button', { name: 'Open for answers' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText("can't be changed after this");
    await dialog.getByRole('button', { name: 'Open for answers' }).click();
    await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);

    // The edit page is closed for opened polls.
    const pollUrl = page.url();
    await page.goto(`${pollUrl}/edit`);
    await expect(page).toHaveURL(pollUrl);

    // Close, behind a confirmation.
    await page.getByRole('button', { name: 'Close poll' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Close poll' }).click();
    await expect(page.getByText(/Closed on/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close poll' })).toHaveCount(0);

    await page.goto('/dashboard');
    await expect(
      page.getByRole('row').filter({ hasText: newTitle }).getByText('Closed')
    ).toBeVisible();
  });

  test('deletes a draft', async ({ page }) => {
    const title = `Delete me ${Date.now()}`;
    await createPoll(page, title, false);

    await page.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText("Delete this draft?");
    await dialog.getByRole('button', { name: 'Delete draft' }).click();

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('link', { name: title })).toHaveCount(0);
  });

  test('shows validation errors and keeps the form', async ({ page }) => {
    await page.goto('/polls/new');
    await page.getByRole('button', { name: 'Save as draft' }).click();
    await expect(page.getByText('Enter a title')).toBeVisible();
    await expect(page.getByText('Enter the question')).toBeVisible();
    await expect(page).toHaveURL('/polls/new');
  });

  test('gets a 404 for a poll that does not exist', async ({ page }) => {
    await page.goto('/polls/zzzzzzzz');
    await expect(page.getByText(/could not be found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open for answers' })).toHaveCount(0);
  });

  test('another researcher cannot see or manage the poll', async ({ page, browser }) => {
    const title = `Not yours ${Date.now()}`;
    await createPoll(page, title, true);
    await page.getByRole('button', { name: 'Open for answers' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Open for answers' }).click();
    await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
    const pollPath = new URL(page.url()).pathname;

    // A second researcher, in a separate browser session.
    const otherContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const other = await otherContext.newPage();
    await signupUserHelper({ page: other, emailAddress: `other${Date.now()}@example.com` });

    // Open polls are public to participants, but the researcher pages stay
    // the owner's: no plan details, no attention-check answer, no actions.
    for (const path of [pollPath, `${pollPath}/edit`]) {
      await other.goto(path);
      await expect(other.getByText('This page could not be found.')).toBeVisible();
      await expect(other.getByText(title)).toHaveCount(0);
      await expect(other.getByText(/Attention check, correct/)).toHaveCount(0);
      await expect(other.getByRole('button', { name: 'Close poll' })).toHaveCount(0);
    }

    // And the poll is not on their dashboard.
    await other.goto('/dashboard');
    await expect(other.getByText(title)).toHaveCount(0);
    await otherContext.close();
  });
});
