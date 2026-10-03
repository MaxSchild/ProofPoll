import { describe, expect, test } from 'vitest';

import { submitResponseSchema } from './answer';

const valid = { pollId: 'k3x9ab2q', answers: { q1: 'Walk', q2: 'Purple' } };

describe('submitResponseSchema', () => {
  test('accepts a poll id with answers', () => {
    expect(submitResponseSchema.safeParse(valid).success).toBe(true);
  });

  test('rejects a malformed poll id', () => {
    for (const pollId of ['', 'short', 'toolong123', 'bad id!!']) {
      expect(submitResponseSchema.safeParse({ ...valid, pollId }).success).toBe(false);
    }
  });

  test('rejects non-string answers', () => {
    expect(
      submitResponseSchema.safeParse({ ...valid, answers: { q1: 3 } }).success
    ).toBe(false);
    expect(submitResponseSchema.safeParse({ ...valid, answers: ['a'] }).success).toBe(false);
  });

  test('rejects answers over 200 characters', () => {
    const answers = { q1: 'x'.repeat(201) };
    expect(submitResponseSchema.safeParse({ ...valid, answers }).success).toBe(false);
    expect(
      submitResponseSchema.safeParse({ ...valid, answers: { q1: 'x'.repeat(200) } }).success
    ).toBe(true);
  });

  test('allows at most 10 answers', () => {
    const many = (n: number) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`q${i + 1}`, 'a']));
    expect(submitResponseSchema.safeParse({ ...valid, answers: many(10) }).success).toBe(true);
    expect(submitResponseSchema.safeParse({ ...valid, answers: many(11) }).success).toBe(false);
  });
});
