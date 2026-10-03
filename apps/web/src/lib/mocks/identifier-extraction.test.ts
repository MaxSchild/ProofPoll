import { describe, expect, test } from 'vitest';

import { extractIdentifiers } from './identifier-extraction';

describe('extractIdentifiers', () => {
  test('finds a DOI in a citation and keeps the title words', () => {
    const result = extractIdentifiers(
      'Author, A. (2026). Commuting and mood. Management Science. https://doi.org/10.1287/mnsc.2026.01234'
    );
    expect(result.dois).toEqual(['10.1287/mnsc.2026.01234']);
    expect(result.terms).toEqual(['author', 'commuting', 'mood', 'management', 'science']);
  });

  test('finds paper and poll ids in AllCounted links', () => {
    const result = extractIdentifiers(
      'Data: https://allcounted.app/papers/AbCd1234 and https://allcounted.app/p/XyZ98765'
    );
    expect(result.ids).toEqual(['AbCd1234', 'XyZ98765']);
    expect(result.dois).toEqual([]);
  });

  test('drops short and common words and numbers', () => {
    expect(extractIdentifiers('The of 2026 mood').terms).toEqual(['mood']);
  });
});
