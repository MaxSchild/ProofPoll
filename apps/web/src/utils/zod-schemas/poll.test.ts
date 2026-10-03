import { describe, expect, test } from 'vitest';

import { emptyPollFormValues } from '@/utils/polls';
import { pollFormSchema, type PollFormValues } from './poll';

function valid(overrides: Partial<PollFormValues> = {}): PollFormValues {
  return {
    ...emptyPollFormValues(),
    title: 'Coffee habits',
    questions: [
      {
        text: 'Coffee or tea?',
        attentionCheck: false,
        options: [
          { text: 'Coffee', correct: false },
          { text: 'Tea', correct: false },
        ],
      },
    ],
    ...overrides,
  };
}

function messages(values: PollFormValues) {
  const result = pollFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe('pollFormSchema', () => {
  test('accepts a minimal poll', () => {
    expect(pollFormSchema.safeParse(valid()).success).toBe(true);
  });

  test('requires a non-blank title', () => {
    expect(messages(valid({ title: '   ' }))).toContain('Enter a title');
  });

  test('limits planned participants to whole numbers from 1', () => {
    expect(pollFormSchema.safeParse(valid({ plannedN: 100 })).success).toBe(true);
    expect(pollFormSchema.safeParse(valid({ plannedN: 0 })).success).toBe(false);
    expect(pollFormSchema.safeParse(valid({ plannedN: 2.5 })).success).toBe(false);
    expect(pollFormSchema.safeParse(valid({ plannedN: 100001 })).success).toBe(false);
  });

  test('needs 1 to 10 questions', () => {
    expect(pollFormSchema.safeParse(valid({ questions: [] })).success).toBe(false);
    const question = valid().questions[0];
    const eleven = Array.from({ length: 11 }, () => question);
    expect(pollFormSchema.safeParse(valid({ questions: eleven })).success).toBe(false);
    const ten = Array.from({ length: 10 }, () => question);
    expect(pollFormSchema.safeParse(valid({ questions: ten })).success).toBe(true);
  });

  test('needs 2 to 8 options per question', () => {
    const base = valid().questions[0];
    const options = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ text: `Option ${i}`, correct: false }));
    expect(
      pollFormSchema.safeParse(valid({ questions: [{ ...base, options: options(1) }] })).success
    ).toBe(false);
    expect(
      pollFormSchema.safeParse(valid({ questions: [{ ...base, options: options(8) }] })).success
    ).toBe(true);
    expect(
      pollFormSchema.safeParse(valid({ questions: [{ ...base, options: options(9) }] })).success
    ).toBe(false);
  });

  test('rejects blank options and duplicates after trimming', () => {
    const base = valid().questions[0];
    const blankOption = { ...base, options: [{ text: 'A', correct: false }, { text: ' ', correct: false }] };
    expect(messages(valid({ questions: [blankOption] }))).toContain('Enter the option text');

    const duplicate = { ...base, options: [{ text: 'A', correct: false }, { text: ' A ', correct: false }] };
    expect(messages(valid({ questions: [duplicate] }))).toContain(
      'Options must be different from each other'
    );
  });

  test('an attention check needs a correct option', () => {
    const base = valid().questions[0];
    expect(
      messages(valid({ questions: [{ ...base, attentionCheck: true }] }))
    ).toContain('Pick the correct option for the attention check');

    const withCorrect = {
      ...base,
      attentionCheck: true,
      options: [{ text: 'Coffee', correct: true }, { text: 'Tea', correct: false }],
    };
    expect(pollFormSchema.safeParse(valid({ questions: [withCorrect] })).success).toBe(true);
  });

  test('allows only one attention check', () => {
    const check = {
      text: 'Pick "Yes"',
      attentionCheck: true,
      options: [{ text: 'Yes', correct: true }, { text: 'No', correct: false }],
    };
    expect(messages(valid({ questions: [check, check] }))).toContain(
      'Only one question can be the attention check'
    );
  });

  test('an author needs a name when an affiliation is given', () => {
    expect(
      pollFormSchema.safeParse(valid({ authors: [{ name: '', affiliation: '' }] })).success
    ).toBe(true);
    expect(
      pollFormSchema.safeParse(valid({ authors: [{ name: '', affiliation: 'WHU' }] })).success
    ).toBe(false);
  });
});
