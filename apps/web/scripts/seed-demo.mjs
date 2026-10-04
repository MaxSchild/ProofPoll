// Seeds the example studies behind "Verify a paper" (spec §1 and §12) by
// driving the app in a browser, exactly as a researcher and participants
// would. Every answer goes through the real answer page, so it is recorded on
// Solana like any other, and no service keys are needed.
//
// Usage (from apps/web):
//   BASE_URL=https://allcounted.vercel.app \
//   DEMO_EMAIL=... DEMO_PASSWORD=... node scripts/seed-demo.mjs
//
// It signs up the demo researcher (or signs in if the account exists) and
// skips any study whose poll title is already on the dashboard.

import { chromium } from '@playwright/test';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3100').replace(/\/$/, '');
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;
// One participant at a time: the public devnet RPC answers bursts with 429s.
const PARALLEL = Number(process.env.PARALLEL ?? 1);
if (!EMAIL || !PASSWORD) throw new Error('Set DEMO_EMAIL and DEMO_PASSWORD');

const AUTHOR = { name: 'Demo Researcher', affiliation: 'AllCounted example' };

/** Expands {option: count} per question into one answer per participant. */
function participants(n, columns) {
  // A fixed shuffle per question, so reruns give the same dataset.
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const shuffled = columns.map((counts) => {
    const list = Object.entries(counts).flatMap(([option, count]) => Array(count).fill(option));
    if (list.length !== n) throw new Error(`Counts add up to ${list.length}, not ${n}`);
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  });
  return Array.from({ length: n }, (_, i) => shuffled.map((list) => list[i]));
}

const STUDIES = [
  {
    poll: {
      title: 'Willingness to pay for reusable coffee cups',
      plan:
        'Example study for the AllCounted demo. Students on campus are asked whether they would pay more for coffee in a reusable cup. Planned: 100 participants, recruited by QR code in the cafeteria.',
      plannedN: 100,
      questions: [
        {
          text: 'Would you pay 10% more for your coffee if it came in a reusable cup?',
          options: ['Yes', 'No', 'Not sure'],
        },
        {
          text: 'How often do you buy coffee on campus?',
          options: ['Daily', 'A few times a week', 'Rarely'],
        },
        {
          text: 'To show that you are reading carefully, please select "Somewhat agree".',
          options: ['Strongly agree', 'Somewhat agree', 'Disagree'],
          correct: 'Somewhat agree',
        },
      ],
      rules: 'Answers that fail the attention check (question 3) are excluded before analysis.',
    },
    answers: participants(100, [
      { Yes: 41, No: 33, 'Not sure': 26 },
      { Daily: 22, 'A few times a week': 47, Rarely: 31 },
      { 'Somewhat agree': 94, 'Strongly agree': 3, Disagree: 3 },
    ]),
    paper: {
      title: 'Students will pay for reusable cups: evidence from a campus survey',
      doi: '10.5555/allcounted.example.cups',
      // The paper reports what the record shows: consistent.
      reportedN: null,
      resultsPublic: true,
    },
  },
  {
    poll: {
      title: 'Remote work and weekly working hours',
      plan:
        'Example study for the AllCounted demo. Employees report how many days a week they work from home. Planned: 40 participants.',
      plannedN: 40,
      questions: [
        {
          text: 'How many days a week do you usually work from home?',
          options: ['None', '1 to 2 days', '3 days or more'],
        },
        {
          text: 'Please select "Blue" to show that you are reading the questions.',
          options: ['Red', 'Blue', 'Green'],
          correct: 'Blue',
        },
      ],
      rules: 'Answers that fail the attention check (question 2) are excluded.',
    },
    answers: participants(40, [
      { None: 9, '1 to 2 days': 18, '3 days or more': 13 },
      { Blue: 37, Red: 2, Green: 1 },
    ]),
    paper: {
      title: 'Working from home does not reduce working hours',
      doi: '10.5555/allcounted.example.remote',
      // 40 recorded, the rule excludes 3, but the paper reports only 30:
      // 7 answers unaccounted for, so the verdict is inconsistent.
      reportedN: '30',
      resultsPublic: false,
    },
  },
];

const step = (message) => console.log(`${new Date().toISOString().slice(11, 19)} ${message}`);

async function signIn(page) {
  await page.goto(`${BASE}/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email address').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  const outcome = await Promise.race([
    page.waitForURL(/\/dashboard/).then(() => 'in'),
    page.getByText(/already registered/i).waitFor().then(() => 'exists'),
  ]);
  if (outcome === 'exists') {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Email address').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
  }
  step(`signed in as ${EMAIL}`);
}

async function createPoll(page, poll) {
  await page.goto(`${BASE}/polls/new`);
  await page.getByLabel('Title *').fill(poll.title);
  await page.getByLabel('Study plan').fill(poll.plan);
  await page.getByLabel('Planned participants').fill(String(poll.plannedN));
  for (const [qi, question] of poll.questions.entries()) {
    const n = qi + 1;
    if (qi > 0) await page.getByRole('button', { name: 'Add question' }).click();
    await page.getByLabel(`Question ${n} text`).fill(question.text);
    for (const [oi, option] of question.options.entries()) {
      if (oi >= 2) await page.getByRole('button', { name: 'Add option' }).nth(qi).click();
      await page.getByRole('textbox', { name: `Option ${oi + 1} of question ${n}` }).fill(option);
    }
    if (question.correct) {
      await page.getByLabel('Use as attention check').nth(qi).check();
      const index = question.options.indexOf(question.correct);
      await page.getByRole('radio', { name: `Option ${index + 1} is the correct answer` }).check();
    }
  }
  await page.getByLabel('Exclude answers that fail the attention check').check();
  await page.getByRole('textbox', { name: 'Exclusion rules' }).fill(poll.rules);
  await page.getByRole('button', { name: 'Save as draft' }).click();
  await page.waitForURL(/\/polls\/[A-Za-z0-9]{8}$/);
  const id = new URL(page.url()).pathname.split('/').pop();

  await page.getByRole('button', { name: 'Open for answers' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Open for answers' }).click();
  const toast = page.locator('[data-sonner-toast]').first();
  await toast.waitFor();
  step(`poll ${id} opened: ${await toast.innerText()}`);
  return id;
}

async function answerAll(browser, pollId, answers) {
  let next = 0;
  let failed = 0;
  async function worker() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultTimeout(90_000);
    while (next < answers.length) {
      const row = answers[next++];
      await page.goto(`${BASE}/p/${pollId}?lab=1`);
      for (const option of row) await page.getByRole('radio', { name: option, exact: true }).click();
      await page.getByRole('button', { name: 'Submit answers' }).click();
      const status = page.getByRole('status');
      await status.getByText('Thank you.').waitFor();
      if (!(await status.innerText()).includes('Recorded on Solana')) failed += 1;
    }
    await context.close();
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  step(`${answers.length} answers to ${pollId}${failed ? `, ${failed} not recorded yet` : ''}`);
  return failed;
}

async function closeAndRecord(page, pollId, failed) {
  await page.goto(`${BASE}/polls/${pollId}`);
  await page.getByRole('button', { name: 'Close poll' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close poll' }).click();
  await page.getByText(/Closed on/).waitFor();
  if (failed) {
    await page.goto(`${BASE}/polls/${pollId}?tab=record`);
    await page.getByRole('button', { name: /missing on Solana/ }).click();
    await page.locator('[data-sonner-toast]').first().waitFor({ timeout: 300_000 });
    step(`retried records: ${await page.locator('[data-sonner-toast]').first().innerText()}`);
  }
}

async function publishPaper(page, pollId, paper) {
  await page.goto(`${BASE}/my-papers/new`);
  await page.getByLabel('Title *').fill(paper.title);
  await page.locator(`#poll-${pollId}`).click();
  await page.getByRole('button', { name: 'Add author' }).click();
  await page.getByPlaceholder('Name').fill(AUTHOR.name);
  await page.getByPlaceholder('Affiliation').fill(AUTHOR.affiliation);
  await page.getByRole('button', { name: 'Create paper' }).click();
  await page.waitForURL(/\/my-papers\/[A-Za-z0-9]{8}$/);
  const paperId = new URL(page.url()).pathname.split('/').pop();

  // The manuscript is only fingerprinted in the browser, never uploaded.
  await page.getByLabel('Start review round 1').setInputFiles({
    name: 'manuscript.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(`%PDF-1.4\n% ${paper.title}\n%%EOF\n`),
  });
  await page.getByRole('heading', { name: 'Confirm the numbers for round 1' }).waitFor();
  if (paper.reportedN) await page.getByLabel('Reported N').fill(paper.reportedN);
  await page.getByRole('button', { name: 'Confirm and check' }).click();
  await page.getByText('Round 1 confirmed and checked').waitFor();

  if (paper.resultsPublic) {
    await page.getByRole('switch', { name: 'Show results publicly' }).click();
  }
  await page.getByLabel('Attach the DOI and publish').fill(paper.doi);
  await page.getByRole('button', { name: 'Publish' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click();
  await page.getByRole('link', { name: paper.doi }).waitFor();
  step(`paper published: ${BASE}/papers/${paperId}`);
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(90_000);
try {
  await signIn(page);
  for (const study of STUDIES) {
    await page.goto(`${BASE}/dashboard`);
    await page.getByRole('heading').first().waitFor();
    if (await page.getByRole('link', { name: study.poll.title }).count()) {
      step(`skipping "${study.poll.title}": already on the dashboard`);
      continue;
    }
    const pollId = await createPoll(page, study.poll);
    const failed = await answerAll(browser, pollId, study.answers);
    await closeAndRecord(page, pollId, failed);
    await publishPaper(page, pollId, study.paper);
  }
  step(`done: ${BASE}/verify`);
} finally {
  await browser.close();
}
