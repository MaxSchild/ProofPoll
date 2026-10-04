import fs from 'node:fs';

import { expect, test } from '@playwright/test';

import { answerPoll, createDraftPoll, openPoll } from '../_helpers/poll.helper';

// Solana records only run when the server has SOLANA_SERVICE_KEY (a funded
// devnet key). Without it, the record pages still work but stay empty.
const solana = Boolean(process.env.SOLANA_SERVICE_KEY);

test.describe('Logged-in user looks at a poll record', () => {
  test('a draft has no record, and its public record page does not exist', async ({ page }) => {
    const id = await createDraftPoll(page, `Record draft ${Date.now()}`);
    await page.goto(`/polls/${id}?tab=record`);
    await expect(page.getByText(/Opening it registers the plan on Solana/)).toBeVisible();

    await page.goto(`/s/${id}`);
    await expect(page.getByText('This page could not be found.')).toBeVisible();
  });

  test('an open poll links to its public record and the dataset check', async ({
    page,
    browser,
  }) => {
    test.skip(solana, 'covered by the devnet test below');
    const title = `Record ${Date.now()}`;
    const id = await createDraftPoll(page, title);
    await openPoll(page);
    await answerPoll(browser, id, [['Coffee', 'Yes']]);

    await page.goto(`/polls/${id}?tab=record`);
    await expect(page.getByRole('link', { name: 'Public record page' })).toHaveAttribute(
      'href',
      `/s/${id}`
    );
    await page.goto(`/s/${id}`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Plan as registered')).toBeVisible();
    await expect(page.getByText('This poll has no record on Solana yet.')).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);

    await expect(
      page.getByRole('link', { name: 'Check a dataset against this record' })
    ).toHaveAttribute('href', `/s/${id}/check`);
    await page.goto(`/s/${id}/check`);
    await page.waitForLoadState('networkidle');
    await page.setInputFiles('#dataset', {
      name: 'data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('response_id,q1,q2\r\nabc,Coffee,Yes\r\n'),
    });
    await page.getByRole('button', { name: 'Check dataset' }).click();
    await expect(page.getByText('This poll has no record on Solana yet.')).toBeVisible();
  });

  test('records the plan and every answer on devnet, and checks a dataset', async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(!solana, 'needs SOLANA_SERVICE_KEY with devnet SOL');
    test.setTimeout(240_000);

    const id = await createDraftPoll(page, `Devnet ${Date.now()}`, {
      attentionCheck: true,
      excludeFailed: true,
    });
    await page.getByRole('button', { name: 'Open for answers' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Open for answers' }).click();
    await expect(page.getByText('Poll opened and plan registered on Solana')).toBeVisible({
      timeout: 60_000,
    });

    // The receipt links to the answer's transaction.
    for (const [drink, check] of [
      ['Coffee', 'Yes'],
      ['Tea', 'Yes'],
      ['Tea', 'No'],
    ]) {
      const participant = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const answerPage = await participant.newPage();
      await answerPage.goto(`/p/${id}`);
      await answerPage.getByRole('radio', { name: drink }).click();
      await answerPage.getByRole('radio', { name: check }).click();
      await answerPage.getByRole('button', { name: 'Submit answers' }).click();
      await expect(answerPage.getByRole('status')).toContainText('Recorded on Solana', {
        timeout: 60_000,
      });
      await expect(answerPage.getByRole('link', { name: /view record/ })).toHaveAttribute(
        'href',
        /^https:\/\/explorer\.solana\.com\/tx\/\w+\?cluster=devnet$/
      );
      await participant.close();
    }

    await page.goto(`/polls/${id}?tab=record`);
    await expect(page.getByRole('link', { name: /See all records on Solana/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Recorded/ })).toHaveCount(3);

    const download = page.waitForEvent('download');
    await page.goto(`/polls/${id}/export.csv`).catch(() => null);
    const csvPath = testInfo.outputPath('dataset.csv');
    await (await download).saveAs(csvPath);
    const [header, ...rows] = fs.readFileSync(csvPath, 'utf8').trim().split('\r\n');

    async function check(csv: string) {
      await page.goto(`/s/${id}/check`);
      await page.waitForLoadState('networkidle');
      await page.setInputFiles('#dataset', {
        name: 'data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csv),
      });
      await page.getByRole('button', { name: 'Check dataset' }).click();
      await expect(page.getByRole('heading', { name: /The dataset (does not )?match/ })).toBeVisible({
        timeout: 60_000,
      });
    }

    // Published without the answer that failed the attention check: passes.
    await check([header, rows[0], rows[1]].join('\r\n'));
    await expect(page.getByRole('heading', { name: 'The dataset matches the record' })).toBeVisible();
    await expect(page.getByText('Left out by the registered attention-check rule')).toBeVisible();

    // One answer changed and one dropped: fails, and says which.
    await check([header, rows[0].replace('Coffee', 'Tea')].join('\r\n'));
    await expect(
      page.getByRole('heading', { name: 'The dataset does not match the record' })
    ).toBeVisible();
    await expect(page.getByText('Changed since recorded')).toBeVisible();
    await expect(page.getByText('Recorded, but missing from the file')).toBeVisible();
  });
});
