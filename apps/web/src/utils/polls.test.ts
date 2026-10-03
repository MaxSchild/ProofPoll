import { describe, expect, test } from 'vitest';

import { buildPollPlan, emptyPollFormValues, pollToFormValues } from './polls';
import type { PollFormValues } from './zod-schemas/poll';

const values: PollFormValues = {
  ...emptyPollFormValues(),
  title: '  Coffee habits ',
  description: ' Plan ',
  plannedN: 50,
  questions: [
    {
      text: ' Coffee or tea? ',
      attentionCheck: false,
      options: [
        { text: ' Coffee', correct: false },
        { text: 'Tea ', correct: false },
      ],
    },
    {
      text: 'Please pick "Yes"',
      attentionCheck: true,
      options: [
        { text: 'No', correct: false },
        { text: 'Yes', correct: true },
      ],
    },
  ],
  exclusionText: ' Drop failed checks ',
  excludeFailedAttentionCheck: true,
  authors: [
    { name: ' Ada ', affiliation: ' WHU ' },
    { name: '', affiliation: '' },
  ],
};

describe('buildPollPlan', () => {
  test('assigns ids by position and trims text', () => {
    const plan = buildPollPlan(values);
    expect(plan.title).toBe('Coffee habits');
    expect(plan.description).toBe('Plan');
    expect(plan.questions).toEqual([
      { id: 'q1', text: 'Coffee or tea?', options: ['Coffee', 'Tea'] },
      { id: 'q2', text: 'Please pick "Yes"', options: ['No', 'Yes'] },
    ]);
  });

  test('maps the attention check to the new id of its question', () => {
    expect(buildPollPlan(values).attentionCheck).toEqual({
      question_id: 'q2',
      correct_option: 'Yes',
    });

    const moved = { ...values, questions: [values.questions[1], values.questions[0]] };
    expect(buildPollPlan(moved).attentionCheck).toEqual({
      question_id: 'q1',
      correct_option: 'Yes',
    });
  });

  test('stores no stale correct flag for a question that is not the check', () => {
    const stale: PollFormValues = {
      ...values,
      questions: [
        { ...values.questions[0], options: [{ text: 'Coffee', correct: true }, { text: 'Tea', correct: false }] },
      ],
    };
    expect(buildPollPlan(stale).attentionCheck).toBeNull();
  });

  test('only excludes failed checks when there is a check', () => {
    expect(buildPollPlan(values).exclusion_rules).toEqual({
      text: 'Drop failed checks',
      exclude_failed_attention_check: true,
    });
    const without = { ...values, questions: [values.questions[0]] };
    expect(buildPollPlan(without).exclusion_rules.exclude_failed_attention_check).toBe(false);
  });

  test('drops empty author rows', () => {
    expect(buildPollPlan(values).authors).toEqual([{ name: 'Ada', affiliation: 'WHU' }]);
  });
});

describe('pollToFormValues', () => {
  test('round-trips a stored plan back into form values', () => {
    const plan = buildPollPlan(values);
    const form = pollToFormValues({ ...plan });
    expect(form.questions[1].attentionCheck).toBe(true);
    expect(form.questions[1].options).toEqual([
      { text: 'No', correct: false },
      { text: 'Yes', correct: true },
    ]);
    expect(form.questions[0].attentionCheck).toBe(false);
    expect(form.excludeFailedAttentionCheck).toBe(true);
    expect(buildPollPlan(form)).toEqual(plan);
  });
});
