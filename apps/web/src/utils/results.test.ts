import { describe, expect, it } from 'vitest';

import type { PollQuestion } from '@/utils/polls';
import { failsAttentionCheck, responsesToCsv, tallyAnswers, type PollResponseRow } from './results';

const questions: PollQuestion[] = [
  { id: 'q1', text: 'Coffee or tea?', options: ['Coffee', 'Tea'] },
  { id: 'q2', text: 'Pick "Yes"', options: ['No', 'Yes'] },
];

const responses: PollResponseRow[] = [
  { id: 'r2', seq: 2, createdAt: '2026-10-03T14:05:00.000Z', answers: { q1: 'Tea', q2: 'No' } },
  { id: 'r1', seq: 1, createdAt: '2026-10-03T14:03:00.000Z', answers: { q1: 'Coffee', q2: 'Yes' } },
  { id: 'r3', seq: 3, createdAt: '2026-10-03T14:07:00.000Z', answers: { q1: 'Coffee', q2: 'Yes' } },
];

describe('tallyAnswers', () => {
  it('counts each option in question and option order', () => {
    const [first, second] = tallyAnswers(questions, responses);
    expect(first.options).toEqual([
      { option: 'Coffee', count: 2 },
      { option: 'Tea', count: 1 },
    ]);
    expect(first.total).toBe(3);
    expect(second.options.map((o) => o.count)).toEqual([1, 2]);
  });

  it('shows every option with zero when there are no answers', () => {
    const [first] = tallyAnswers(questions, []);
    expect(first.options).toEqual([
      { option: 'Coffee', count: 0 },
      { option: 'Tea', count: 0 },
    ]);
    expect(first.total).toBe(0);
  });
});

describe('failsAttentionCheck', () => {
  const check = { question_id: 'q2', correct_option: 'Yes' };

  it('flags answers that pick another option', () => {
    expect(failsAttentionCheck(responses[0], check)).toBe(true);
    expect(failsAttentionCheck(responses[1], check)).toBe(false);
  });

  it('never flags anything without an attention check', () => {
    expect(failsAttentionCheck(responses[0], null)).toBe(false);
  });
});

describe('responsesToCsv', () => {
  it('writes a header and one row per answer in arrival order', () => {
    expect(responsesToCsv(questions, responses)).toBe(
      [
        'response_id,seq,submitted_at,q1,q2',
        'r1,1,2026-10-03T14:03:00.000Z,Coffee,Yes',
        'r2,2,2026-10-03T14:05:00.000Z,Tea,No',
        'r3,3,2026-10-03T14:07:00.000Z,Coffee,Yes',
        '',
      ].join('\r\n')
    );
  });

  it('quotes commas, quotes and line breaks', () => {
    const csv = responsesToCsv(
      [{ id: 'q1', text: 'Q', options: ['a, b', 'say "hi"', 'two\nlines'] }],
      [
        { id: 'r1', seq: 1, createdAt: '2026-10-03T14:03:00Z', answers: { q1: 'a, b' } },
        { id: 'r2', seq: 2, createdAt: '2026-10-03T14:03:00Z', answers: { q1: 'say "hi"' } },
        { id: 'r3', seq: 3, createdAt: '2026-10-03T14:03:00Z', answers: { q1: 'two\nlines' } },
      ]
    );
    expect(csv).toContain(',"a, b"\r\n');
    expect(csv).toContain(',"say ""hi"""\r\n');
    expect(csv).toContain(',"two\nlines"\r\n');
  });

  it('writes answers exactly as given, including formula-like text', () => {
    const csv = responsesToCsv(
      [{ id: 'q1', text: 'Q', options: ['=1+1', 'ok'] }],
      [{ id: 'r1', seq: 1, createdAt: '2026-10-03T14:03:00Z', answers: { q1: '=1+1' } }]
    );
    expect(csv).toContain(',=1+1\r\n');
  });
});
