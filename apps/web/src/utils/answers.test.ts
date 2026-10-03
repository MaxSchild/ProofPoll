import { describe, expect, test } from 'vitest';

import {
  newClientId,
  countAnswered,
  formatCountdown,
  isComplete,
  parseStoredReceipt,
  receiptStorageKey,
} from './answers';
import type { PollQuestion } from './polls';

const questions: PollQuestion[] = [
  { id: 'q1', text: 'Walk or bike?', options: ['Walk', 'Bike'] },
  { id: 'q2', text: 'Colour?', options: ['Purple', 'Green'] },
];

describe('answer completeness', () => {
  test('counts only chosen questions of this poll', () => {
    expect(countAnswered(questions, {})).toBe(0);
    expect(countAnswered(questions, { q1: 'Walk' })).toBe(1);
    expect(countAnswered(questions, { q1: 'Walk', q9: 'x' })).toBe(1);
    expect(countAnswered(questions, { q1: '', q2: 'Green' })).toBe(1);
  });

  test('is complete only when every question is answered', () => {
    expect(isComplete(questions, { q1: 'Walk' })).toBe(false);
    expect(isComplete(questions, { q1: 'Walk', q2: 'Green' })).toBe(true);
    expect(isComplete([], {})).toBe(false);
  });
});

describe('formatCountdown', () => {
  test('formats whole seconds and never goes negative', () => {
    expect(formatCountdown(12)).toBe('Next participant in 12 s');
    expect(formatCountdown(0.2)).toBe('Next participant in 1 s');
    expect(formatCountdown(-3)).toBe('Next participant in 0 s');
  });
});

describe('stored receipt', () => {
  test('keys per poll', () => {
    expect(receiptStorageKey('abc12345')).not.toBe(receiptStorageKey('abc12346'));
  });

  test('parses a valid receipt', () => {
    expect(
      parseStoredReceipt('{"seq":17,"createdAt":"2026-10-03T14:03:00Z"}')
    ).toEqual({ seq: 17, createdAt: '2026-10-03T14:03:00Z' });
  });

  test('ignores missing, broken or odd values', () => {
    for (const raw of [
      null,
      '',
      'nope',
      '3',
      'null',
      '{"seq":0,"createdAt":"2026-10-03T14:03:00Z"}',
      '{"seq":"1","createdAt":"2026-10-03T14:03:00Z"}',
      '{"seq":1,"createdAt":"yesterday"}',
    ]) {
      expect(parseStoredReceipt(raw)).toBeNull();
    }
  });
});

describe('newClientId', () => {
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  test('returns a v4 UUID', () => {
    expect(newClientId()).toMatch(uuidV4);
  });

  test('falls back to getRandomValues outside secure contexts', () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const a = newClientId();
      expect(a).toMatch(uuidV4);
      expect(newClientId()).not.toBe(a);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});
