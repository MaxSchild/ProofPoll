import { describe, expect, test } from 'vitest';

import {
  anonymousAuthors,
  describeCountCheck,
  describeCountGap,
  describeExclusionNote,
  parseDoi,
  toPercentages,
  type CountCheck,
} from './verification';

const consistent: CountCheck = {
  ran: true,
  recorded: 100,
  excluded_by_rule: 6,
  expected: 94,
  reported_n: 94,
  reported_exclusions: 6,
  gap: 0,
  verdict: 'consistent',
};

describe('describeCountCheck', () => {
  test('spells out recorded, excluded and reported', () => {
    expect(describeCountCheck(consistent)).toBe(
      'Recorded 100 · rule excludes 6 · paper reports 94 → consistent'
    );
  });

  test('leaves out the rule when it excludes nothing', () => {
    expect(
      describeCountCheck({ ...consistent, excluded_by_rule: 0, reported_n: 86, gap: 14, verdict: 'inconsistent' })
    ).toBe('Recorded 100 · paper reports 86 → inconsistent');
  });

  test('says when the paper reports no N', () => {
    expect(describeCountCheck({ ran: false, recorded: 12, excluded_by_rule: 0 })).toBe(
      'Recorded 12 · the paper reports no N'
    );
  });
});

describe('describeCountGap', () => {
  test('is null without a gap', () => {
    expect(describeCountGap(consistent)).toBeNull();
  });

  test('counts unaccounted answers', () => {
    expect(describeCountGap({ ...consistent, gap: 14 })).toMatch(/^14 answers unaccounted for/);
    expect(describeCountGap({ ...consistent, gap: 1 })).toMatch(/^1 answer unaccounted for/);
  });

  test('flags papers that report more than was recorded', () => {
    expect(describeCountGap({ ...consistent, gap: -6 })).toMatch(/reports 6 answers more/);
  });
});

describe('describeExclusionNote', () => {
  test('is null when the stated exclusions match the rules', () => {
    expect(describeExclusionNote(consistent)).toBeNull();
    expect(describeExclusionNote({ ...consistent, reported_exclusions: null })).toBeNull();
  });

  test('notes a different number of exclusions', () => {
    expect(describeExclusionNote({ ...consistent, reported_exclusions: 8 })).toBe(
      'The paper states 8 exclusions; the registered rules exclude 6.'
    );
  });
});

describe('anonymousAuthors', () => {
  test('numbers the authors', () => {
    expect(anonymousAuthors(3)).toBe('Author 1, Author 2, Author 3');
    expect(anonymousAuthors(0)).toBe('Not stated');
  });
});

describe('parseDoi', () => {
  test.each([
    ['10.1287/mnsc.2026.01234', '10.1287/mnsc.2026.01234'],
    ['https://doi.org/10.1287/MNSC.2026.01234', '10.1287/mnsc.2026.01234'],
    ['doi:10.5555/abc.1.', '10.5555/abc.1'],
    ['Author, A. (2026). Title. Journal, 1(2). https://doi.org/10.1000/xyz123),', '10.1000/xyz123'],
  ])('finds the DOI in %s', (input, doi) => {
    expect(parseDoi(input)).toBe(doi);
  });

  test('is null without a DOI', () => {
    expect(parseDoi('Commuting and mood, 2026')).toBeNull();
  });
});

describe('toPercentages', () => {
  test('rounds to whole percent of the base', () => {
    expect(toPercentages({ Walk: 2, Bike: 1 }, 3)).toEqual({ Walk: 67, Bike: 33 });
    expect(toPercentages({ Walk: 0 }, 0)).toEqual({ Walk: 0 });
  });
});
