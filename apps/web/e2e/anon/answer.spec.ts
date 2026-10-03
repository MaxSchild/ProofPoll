import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

import { closePoll, createDraftPoll, openPoll } from '../_helpers/poll.helper';
import { signupUserHelper } from '../_helpers/signup.helper';

// Polls are created by a researcher in a separate browser context, since the
// anon project has no logged-in user. One poll per scenario keeps the answer
// numbers (#1, #2) deterministic.
const polls = { main: '', count: '', lab: '', phone: '', closed: '' };
let owner: { context: BrowserContext; page: Page };

async function answerAll(page: Page, coffee = 'Coffee') {
  await page.getByRole('radio', { name: coffee }).click();
  await page.getByRole('radio', { name: 'Yes' }).click();
}

const { defaultBrowserType: _ignored, ...iPhone13 } = devices['iPhone 13'];

test.describe('Anonymous user answers a poll', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await signupUserHelper({
      page,
      emailAddress: `answers${Date.now()}@example.com`,
    });
    owner = { context, page };

    for (const key of ['main', 'count', 'lab', 'phone', 'closed'] as const) {
      polls[key] = await createDraftPoll(
        page,
        `Answer test ${key} ${Date.now()}`,
      );
      await openPoll(page);
    }
    await page.goto(`/polls/${polls.closed}`);
    await closePoll(page);
  });

  test.afterAll(async () => {
    await owner.context.close();
  });

  test('answers on a desktop, gets a numbered receipt and is locked on reload', async ({
    page,
  }) => {
    await page.goto(`/p/${polls.main}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Answer test main',
    );
    await expect(page.getByText('A short test study.')).toBeVisible();
    await expect(page.getByText('0 of 2 questions answered')).toBeVisible();

    // Not indexable, no app shell.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);

    const submit = page.getByRole('button', { name: 'Submit answers' });
    await expect(submit).toBeDisabled();
    await expect(
      page.getByText('Answer all questions to submit.'),
    ).toBeVisible();

    await page.getByRole('radio', { name: 'Coffee' }).click();
    await expect(page.getByText('1 of 2 questions answered')).toBeVisible();
    await expect(submit).toBeDisabled();

    // Arrow keys move within a group; Enter in a group does not submit.
    await page.getByRole('radio', { name: 'No' }).focus();
    // Radix moves focus (and selects) a tick after keydown, so hold the key
    // briefly like a person would.
    await page.keyboard.press('ArrowDown', { delay: 100 });
    await expect(page.getByRole('radio', { name: 'Yes' })).toBeChecked();
    await page.keyboard.press('Enter');
    await expect(page.getByText('2 of 2 questions answered')).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect(page.getByText('Thank you.')).toHaveCount(0);

    await submit.click();
    await expect(
      page.getByRole('heading', { name: 'Thank you.' }),
    ).toBeFocused();
    await expect(page.getByRole('status')).toContainText(
      /Your answer is #1 in this poll, saved at \d{2}:\d{2}/,
    );
    await expect(
      page.getByText('You already answered on this device.'),
    ).toHaveCount(0);

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Thank you.' }),
    ).toBeVisible();
    await expect(page.getByText('#1', { exact: false }).first()).toBeVisible();
    await expect(
      page.getByText('You already answered on this device.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Submit answers' }),
    ).toHaveCount(0);
  });

  test('participants get consecutive numbers and the researcher sees the count', async ({
    browser,
  }) => {
    // Its own poll, so it does not depend on the other tests' answers.
    for (const [coffee, number] of [
      ['Coffee', '#1'],
      ['Tea', '#2'],
    ] as const) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`/p/${polls.count}`);
      await answerAll(page, coffee);
      await page.getByRole('button', { name: 'Submit answers' }).click();
      await expect(page.getByRole('status')).toContainText(number);
      await context.close();
    }

    await owner.page.goto(`/polls/${polls.count}`);
    await expect(owner.page.getByText('2 / 50')).toBeVisible();
    await owner.page.goto('/dashboard');
    await expect(
      owner.page
        .getByRole('row')
        .filter({ hasText: 'Answer test count' })
        .getByText('2 / 50'),
    ).toBeVisible();
  });

  test('lab mode resets to an empty form and numbers the next participant', async ({
    page,
  }) => {
    await page.goto(`/p/${polls.lab}?lab=1`);
    await expect(page.getByText('Lab mode', { exact: true })).toBeVisible();

    await answerAll(page);
    await page.getByRole('button', { name: 'Submit answers' }).click();
    await expect(page.getByRole('status')).toContainText('#1');
    const next = page.getByRole('button', { name: 'Next participant' });
    await expect(next).toBeFocused();
    await expect(page.getByText(/Next participant in \d+ s/)).toBeVisible();

    await next.click();
    await expect(page.getByText('0 of 2 questions answered')).toBeVisible();
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Coffee' })).toBeFocused();

    // Not locked: a reload shows the form, and the next answer is #2.
    await page.reload();
    await expect(page.getByText('0 of 2 questions answered')).toBeVisible();
    await answerAll(page, 'Tea');
    await page.getByRole('button', { name: 'Submit answers' }).click();
    await expect(page.getByRole('status')).toContainText('#2');
  });

  test('a closed poll says it is not accepting answers', async ({ page }) => {
    await page.goto(`/p/${polls.closed}`);
    await expect(
      page.getByRole('heading', { name: "This poll isn't accepting answers." }),
    ).toBeVisible();
    await expect(
      page.getByText('contact the person who shared the link'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Submit answers' }),
    ).toHaveCount(0);
  });

  test('a poll that closes while the form is open shows the database message', async ({
    page,
  }) => {
    await createAndOpenThenFill(page);
  });

  test('an unknown poll id is not found', async ({ page }) => {
    await page.goto('/p/zzzzzzzz');
    await expect(
      page.getByRole('heading', { name: 'Poll not found.' }),
    ).toBeVisible();
    await page.goto('/p/not-an-id');
    await expect(
      page.getByRole('heading', { name: 'Poll not found.' }),
    ).toBeVisible();
  });

  async function createAndOpenThenFill(page: Page) {
    const id = await createDraftPoll(owner.page, `Closing soon ${Date.now()}`);
    await openPoll(owner.page);

    await page.goto(`/p/${id}`);
    await answerAll(page);
    await closePoll(owner.page);

    await page.getByRole('button', { name: 'Submit answers' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'not accepting' }),
    ).toContainText('This poll is not accepting answers');
    // The answers are kept.
    await expect(page.getByRole('radio', { name: 'Coffee' })).toBeChecked();
    await expect(page.getByText('2 of 2 questions answered')).toBeVisible();
  }

  test.describe('on a phone', () => {
    test.use(iPhone13);

    test('completes the form on a phone viewport', async ({ page }) => {
      await page.goto(`/p/${polls.phone}`);
      const option = page.getByRole('radio', { name: 'Coffee' });
      await expect(option).toBeVisible();

      // Option rows are at least 56 px tall and fit the viewport width.
      const row = option.locator('xpath=..');
      const box = await row.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(56);
      const hasOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(hasOverflow).toBe(false);

      await answerAll(page);
      await page.getByRole('button', { name: 'Submit answers' }).tap();
      await expect(page.getByRole('status')).toContainText('#1');
    });
  });
});
