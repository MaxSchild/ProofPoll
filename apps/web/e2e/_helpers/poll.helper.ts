import { expect, type Browser, type Page } from '@playwright/test';

/**
 * Creates a draft poll with two questions through the form and returns its
 * id: "Coffee or tea?" (Coffee, Tea) and 'Please select "Yes"' (No, Yes).
 * The page must belong to a logged-in researcher.
 */
export async function createDraftPoll(
  page: Page,
  title: string,
  {
    plannedN = 50,
    attentionCheck = false,
    excludeFailed = false,
  }: { plannedN?: number; attentionCheck?: boolean; excludeFailed?: boolean } = {},
): Promise<string> {
  await page.goto('/polls/new');
  await page.getByLabel('Title *').fill(title);
  await page.getByLabel('Study plan').fill('A short test study.\nSecond line.');
  await page.getByLabel('Planned participants').fill(String(plannedN));

  await page.getByLabel('Question 1 text').fill('Coffee or tea?');
  await page
    .getByRole('textbox', { name: 'Option 1 of question 1' })
    .fill('Coffee');
  await page
    .getByRole('textbox', { name: 'Option 2 of question 1' })
    .fill('Tea');

  await page.getByRole('button', { name: 'Add question' }).click();
  await page.getByLabel('Question 2 text').fill('Please select "Yes"');
  await page
    .getByRole('textbox', { name: 'Option 1 of question 2' })
    .fill('No');
  await page
    .getByRole('textbox', { name: 'Option 2 of question 2' })
    .fill('Yes');

  if (attentionCheck) {
    // Question 2 checks attention; "Yes" is the correct option.
    await page.getByLabel('Use as attention check').nth(1).check();
    await page
      .getByRole('radio', { name: 'Option 2 is the correct answer' })
      .check();
    if (excludeFailed) {
      await page.getByLabel('Exclude answers that fail the attention check').check();
    }
  }

  await page.getByRole('button', { name: 'Save as draft' }).click();
  await expect(page).toHaveURL(/\/polls\/[A-Za-z0-9]{8}$/);
  return new URL(page.url()).pathname.split('/').pop() as string;
}

export async function openPoll(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open for answers' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Open for answers' })
    .click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
}

export async function closePoll(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close poll' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Close poll' })
    .click();
  await expect(page.getByText(/Closed on/)).toBeVisible();
}

/**
 * Answers the two-question poll from createDraftPoll once per entry, each
 * time as a new participant (a fresh browser context, so the "already
 * answered" receipt doesn't get in the way).
 */
export async function answerPoll(
  browser: Browser,
  pollId: string,
  answers: ReadonlyArray<readonly [drink: string, check: string]>,
): Promise<void> {
  for (const [drink, check] of answers) {
    const participant = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await participant.newPage();
    await page.goto(`/p/${pollId}`);
    await page.getByRole('radio', { name: drink }).click();
    await page.getByRole('radio', { name: check }).click();
    await page.getByRole('button', { name: 'Submit answers' }).click();
    await expect(page.getByRole('status')).toContainText('Thank you.');
    await participant.close();
  }
}
