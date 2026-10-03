import { expect, test, type Page } from '@playwright/test';

import { answerPoll, closePoll, createDraftPoll, openPoll } from '../_helpers/poll.helper';

// Minimal PDFs: only the first bytes ("%PDF-") and the fingerprint matter.
const manuscript = (name: string, body: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(`%PDF-1.4\n% ${body}\n%%EOF\n`),
});

async function confirmRound(page: Page, round: number) {
  await page.getByRole('button', { name: 'Confirm and check' }).click();
  await expect(page.getByText(`Round ${round} confirmed and checked`)).toBeVisible();
  await expect(page.getByLabel(`Review link, round ${round}`, { exact: true })).toBeVisible();
}

test.describe('Logged-in user verifies a paper against the record', () => {
  test('groups polls into a paper, checks review rounds and publishes it', async ({
    page,
    browser,
  }) => {
    const stamp = Date.now();
    // Four answers; the last fails the attention check, which the rule excludes.
    const pollId = await createDraftPoll(page, `Paper study ${stamp}`, {
      plannedN: 4,
      attentionCheck: true,
      excludeFailed: true,
    });
    await openPoll(page);
    await answerPoll(browser, pollId, [
      ['Coffee', 'Yes'],
      ['Coffee', 'Yes'],
      ['Tea', 'Yes'],
      ['Tea', 'No'],
    ]);
    const pilotId = await createDraftPoll(page, `Paper pilot ${stamp}`);
    await openPoll(page);

    // A paper with an open poll can't go to review.
    const title = `Coffee habits ${stamp}`;
    await page.goto('/my-papers/new');
    await page.getByLabel('Title *').fill(title);
    await page.locator(`#poll-${pollId}`).click();
    await page.locator(`#poll-${pilotId}`).click();
    await page.getByRole('button', { name: 'Add author' }).click();
    await page.getByPlaceholder('Name').fill('Ada Author');
    await page.getByPlaceholder('Affiliation').fill('WHU');
    await page.getByRole('button', { name: 'Create paper' }).click();
    await expect(page).toHaveURL(/\/my-papers\/[A-Za-z0-9]{8}$/);
    const paperId = new URL(page.url()).pathname.split('/').pop() as string;
    await expect(page.getByText(/Close all polls before sending the paper to review/)).toBeVisible();

    // Close the study, drop the pilot from the paper.
    await page.goto(`/polls/${pollId}`);
    await closePoll(page);
    await expect(page.getByRole('link', { name: title })).toBeVisible();
    await page.goto(`/my-papers/${paperId}/edit`);
    await page.locator(`#poll-${pilotId}`).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(new RegExp(`/my-papers/${paperId}$`));

    // Round 1: only PDFs, extracted numbers proposed, consistent.
    await page.getByLabel('Start review round 1').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a pdf'),
    });
    await expect(page.getByText('This file is not a PDF.')).toBeVisible();
    await page.getByLabel('Start review round 1').setInputFiles(manuscript('round-1.pdf', 'one'));
    await expect(page.getByRole('heading', { name: 'Confirm the numbers for round 1' })).toBeVisible();
    await expect(page.getByLabel('Reported N')).toHaveValue('3');
    await expect(page.getByLabel('Reported exclusions')).toHaveValue('1');
    await confirmRound(page, 1);
    await expect(page.getByText('Recorded 4 · rule excludes 1 · paper reports 3 → consistent')).toBeVisible();
    const reviewUrl1 = await page.getByLabel('Review link, round 1', { exact: true }).inputValue();

    // Round 2: the paper drops an answer and misreports a result.
    await page.getByLabel('Start review round 2').setInputFiles(manuscript('round-2.pdf', 'two'));
    await expect(page.getByRole('heading', { name: 'Confirm the numbers for round 2' })).toBeVisible();
    await page.getByLabel('Reported N').fill('2');
    await page.getByLabel('Study 1, question 1, Coffee: reported percent').fill('50');
    await confirmRound(page, 2);
    await expect(page.getByText('Recorded 4 · rule excludes 1 · paper reports 2 → inconsistent')).toBeVisible();
    await expect(page.getByText(/^1 answer unaccounted for/)).toBeVisible();
    await expect(page.getByText('paper 50% / record 66.7%')).toBeVisible();

    // Reviewers: anonymised, round by round, with a local file check.
    const reviewer = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const review = await reviewer.newPage();
    await review.goto(reviewUrl1);
    await expect(review.getByRole('heading', { name: title })).toBeVisible();
    await expect(review.getByText('Authors: Author 1')).toBeVisible();
    await expect(review.getByText('Ada Author')).toHaveCount(0);
    await expect(review.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(review.getByText('Consistent', { exact: true })).toBeVisible();
    await review.getByLabel('Compare with your copy').setInputFiles(manuscript('mine.pdf', 'one'));
    await expect(review.getByRole('status')).toHaveText('mine.pdf is the file that was checked.');
    await review.getByLabel('Compare with your copy').setInputFiles(manuscript('other.pdf', 'two'));
    await expect(review.getByRole('status')).toContainText('is a different file');

    // Not public yet.
    await review.goto(`/papers/${paperId}`);
    await expect(review.getByRole('heading', { name: title })).toHaveCount(0);

    // Mocked DOI detection, then no reply for 14 days.
    await page.getByRole('button', { name: 'Run detection now' }).click();
    await expect(page.getByText('Is this your paper?')).toBeVisible();
    await page.getByRole('button', { name: 'Skip the 14-day wait' }).click();
    await expect(page.getByText('Matched automatically')).toBeVisible();
    await page.getByRole('switch', { name: 'Show results publicly' }).click();
    await expect(page.getByRole('switch', { name: 'Show results publicly' })).toBeChecked();

    // Public page: real authors, latest round, results opted in.
    await review.goto(`/papers/${paperId}`);
    await expect(review.getByRole('heading', { name: title })).toBeVisible();
    await expect(review.getByText('Ada Author (WHU)')).toBeVisible();
    await expect(review.getByText('Matched automatically')).toBeVisible();
    await expect(review.getByText('Inconsistent', { exact: true })).toBeVisible();
    // Coffee and Tea 2 each of 4; Yes 3, No 1 (counts before exclusions).
    await expect(review.getByText('2 · 50%')).toHaveCount(2);
    await expect(review.getByText('3 · 75%')).toBeVisible();

    // Search by citation, DOI and poll link.
    for (const query of [
      `Author, A. (2026). Coffee habits ${stamp}. Some Journal.`,
      `https://doi.org/10.5555/allcounted.${paperId.toLowerCase()}`,
      `Data at http://localhost:3100/p/${pollId}`,
    ]) {
      await review.goto(`/verify?q=${encodeURIComponent(query)}`);
      await expect(review.getByRole('link', { name: title })).toBeVisible();
    }
    await reviewer.close();
  });

  test('a signed-out visitor cannot see a draft paper', async ({ page, browser }) => {
    const pollId = await createDraftPoll(page, `Private paper poll ${Date.now()}`);
    await openPoll(page);
    await page.goto('/my-papers/new');
    await page.getByLabel('Title *').fill('Private paper');
    await page.locator(`#poll-${pollId}`).click();
    await page.getByRole('button', { name: 'Create paper' }).click();
    await expect(page).toHaveURL(/\/my-papers\/[A-Za-z0-9]{8}$/);
    const paperId = new URL(page.url()).pathname.split('/').pop() as string;

    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const otherPage = await other.newPage();
    await otherPage.goto(`/my-papers/${paperId}`);
    await expect(otherPage).toHaveURL(/\/login$/);
    await otherPage.goto(`/papers/${paperId}`);
    await expect(otherPage.getByRole('heading', { name: 'Private paper' })).toHaveCount(0);
    await other.close();
  });
});
