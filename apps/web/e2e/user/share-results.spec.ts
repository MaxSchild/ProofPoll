import { expect, test } from '@playwright/test';

import { createDraftPoll, openPoll } from '../_helpers/poll.helper';

test.describe('Logged-in user shares a poll and reads its results', () => {
  test('a draft has nothing to share yet', async ({ page }) => {
    const id = await createDraftPoll(page, `Share draft ${Date.now()}`);
    await page.goto(`/polls/${id}?tab=share`);
    await expect(
      page.getByText('This poll is a draft. Open it to get a link and QR code.')
    ).toBeVisible();
  });

  test('shares links and a QR code, then shows answers and exports them', async ({
    page,
    browser,
    context,
  }) => {
    const id = await createDraftPoll(page, `Results ${Date.now()}`, { attentionCheck: true });
    await openPoll(page);

    // Share tab: answer link, lab link and QR code.
    await page.getByRole('tab', { name: 'Share' }).click();
    await expect(page).toHaveURL(/\?tab=share$/);
    const answerLink = page.getByLabel('Answer link', { exact: true });
    await expect(answerLink).toHaveValue(new RegExp(`/p/${id}$`));
    await expect(page.getByLabel('Lab mode link', { exact: true })).toHaveValue(new RegExp(`/p/${id}\\?lab=1$`));
    await expect(page.getByRole('img', { name: 'QR code for the answer link' })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Copy answer link' }).click();
    await expect(page.getByText('Link copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      new RegExp(`/p/${id}$`)
    );

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    expect((await download).suggestedFilename()).toBe(`allcounted-${id}-qr.png`);

    // Results before any answers.
    await page.getByRole('tab', { name: 'Results' }).click();
    await expect(page.getByText('No answers yet. Share the link to start collecting.')).toBeVisible();

    // Three participants; the third fails the attention check.
    for (const [drink, check] of [
      ['Coffee', 'Yes'],
      ['Coffee', 'Yes'],
      ['Tea', 'No'],
    ] as const) {
      const participant = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const answerPage = await participant.newPage();
      await answerPage.goto(`/p/${id}`);
      await answerPage.getByRole('radio', { name: drink }).click();
      await answerPage.getByRole('radio', { name: check }).click();
      await answerPage.getByRole('button', { name: 'Submit answers' }).click();
      await expect(answerPage.getByRole('status')).toContainText('Thank you.');
      await participant.close();
    }

    await page.reload();
    await expect(page.getByText(/3\s+answers recorded/)).toBeVisible();
    await expect(page.getByText(/1\s+failed the\s+attention check/)).toBeVisible();
    // Both questions: 2 of 3 picked the first answer (Coffee, Yes), 1 the other.
    await expect(page.getByText('2 · 67%')).toHaveCount(2);
    await expect(page.getByText('1 · 33%')).toHaveCount(2);

    const rows = page.getByRole('table').getByRole('row');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(3)).toContainText('Failed');
    await expect(rows.nth(1)).toContainText('Passed');

    // CSV export: header plus one row per answer, in arrival order.
    const csvDownload = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download CSV' }).click();
    const file = await csvDownload;
    expect(file.suggestedFilename()).toBe(`allcounted-${id}.csv`);
    const path = await file.path();
    const { readFile } = await import('node:fs/promises');
    const lines = (await readFile(path, 'utf8')).trim().split(/\r\n/);
    expect(lines[0]).toBe('response_id,seq,submitted_at,q1,q2');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(/^[A-Za-z0-9]{12},1,\d{4}-\d\d-\d\dT[\d:.]+Z,Coffee,Yes$/);
    expect(lines[3]).toMatch(/,3,.*,Tea,No$/);
  });

  test('another researcher cannot download the CSV', async ({ page, browser }) => {
    const id = await createDraftPoll(page, `Private CSV ${Date.now()}`);
    await openPoll(page);

    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const otherPage = await other.newPage();
    const response = await otherPage.request.get(`/polls/${id}/export.csv`, { maxRedirects: 0 });
    // Signed out: redirected to sign-in by the middleware, never the file.
    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toMatch(/\/login$/);
    await other.close();
  });
});
