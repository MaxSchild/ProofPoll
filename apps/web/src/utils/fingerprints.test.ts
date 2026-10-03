import { describe, expect, it } from 'vitest';

import {
  answerMemo,
  canonicalJson,
  leafHash,
  parseCsv,
  parseMemo,
  planHash,
  planMemo,
  sha256Hex,
} from './fingerprints';
import { responsesToCsv } from './results';

const SALT = 'ab'.repeat(32);

describe('canonicalJson', () => {
  it('sorts keys at every level and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 'x', c: null }, 2] })).toBe(
      '{"a":[{"c":null,"d":"x"},2],"b":1}'
    );
  });

  it('ignores the order keys were written in', () => {
    expect(canonicalJson({ q2: 'No', q1: 'Yes' })).toBe(canonicalJson({ q1: 'Yes', q2: 'No' }));
  });
});

describe('sha256Hex', () => {
  it('matches the known digest of "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});

describe('planHash', () => {
  const plan = {
    title: 'Colour',
    description: 'Which colour?',
    planned_n: 100,
    questions: [{ id: 'q1', text: 'Pick', options: ['Red', 'Blue'] }],
    exclusion_rules: { text: '', exclude_failed_attention_check: false },
  };

  it('changes when any part of the plan changes', async () => {
    const base = await planHash(plan);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(await planHash({ ...plan, planned_n: 101 })).not.toBe(base);
    expect(
      await planHash({ ...plan, questions: [{ id: 'q1', text: 'Pick', options: ['Blue', 'Red'] }] })
    ).not.toBe(base);
  });
});

describe('leaf hashes through the exported CSV', () => {
  it('gives the same hash after answers -> CSV -> parse', async () => {
    const questions = [
      { id: 'q1', text: 'A', options: ['Yes, "really"', 'No'] },
      { id: 'q2', text: 'B', options: ['x,y', 'line\nbreak'] },
    ];
    const answers = { q1: 'Yes, "really"', q2: 'line\nbreak' };
    const csv = responsesToCsv(questions, [
      { id: 'resp00000001', seq: 1, createdAt: '2026-10-04T10:00:00Z', answers },
    ]);
    const [header, row] = parseCsv(csv);
    const parsed = Object.fromEntries(
      questions.map((question) => [question.id, row[header.indexOf(question.id)]])
    );
    const input = { pollId: 'Abc12345', responseId: 'resp00000001', saltHex: SALT };
    expect(await leafHash({ ...input, answers: parsed })).toBe(
      await leafHash({ ...input, answers })
    );
  });

  it('detects a changed answer', async () => {
    const input = { pollId: 'Abc12345', responseId: 'r1', saltHex: SALT };
    expect(await leafHash({ ...input, answers: { q1: 'Yes' } })).not.toBe(
      await leafHash({ ...input, answers: { q1: 'No' } })
    );
  });
});

describe('memos', () => {
  const hash = 'f'.repeat(64);

  it('round-trips plan and answer memos, also with the RPC length prefix', () => {
    expect(parseMemo(planMemo('Abc12345', hash))).toEqual({
      kind: 'plan',
      pollId: 'Abc12345',
      hash,
    });
    expect(parseMemo(`[87] ${answerMemo('Abc12345', 17, hash)}`)).toEqual({
      kind: 'ans',
      pollId: 'Abc12345',
      seq: 17,
      hash,
    });
  });

  it('ignores memos that are not ours', () => {
    expect(parseMemo('[5] hello')).toBeNull();
    expect(parseMemo(`AC1 ans Abc12345 ${hash}`)).toBeNull();
  });
});
