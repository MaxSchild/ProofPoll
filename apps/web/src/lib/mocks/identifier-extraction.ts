import { parseDoi } from '@/utils/verification';

/*
 * MOCK: identifier extraction for the public search (prototype spec §12.2,
 * step 7).
 *
 * Real version: an LLM reads whatever was pasted (a DOI, a title, authors,
 * a full citation) and returns the identifiers; DOIs are resolved through
 * Crossref to their title and authors before matching.
 *
 * Here: regular expressions find DOIs and ProofPoll links, and the other
 * words (minus common ones) become search terms for titles and authors.
 */

export interface PaperIdentifiers {
  dois: string[];
  /** Paper or poll ids from ProofPoll links. */
  ids: string[];
  terms: string[];
}

const STOP_WORDS = new Set(
  'the and for with from into that this are was were has have not but its our their via doi org http https www journal vol pp'.split(
    ' '
  )
);

const LINK_PATTERN = /\/(?:papers|p)\/([A-Za-z0-9]{8})\b/g;

export function extractIdentifiers(text: string): PaperIdentifiers {
  const input = text.slice(0, 2000);
  const doi = parseDoi(input);
  const ids = [...input.matchAll(LINK_PATTERN)].map((match) => match[1]);

  const rest = input
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b10\.\d{4,9}\/\S+/g, ' ');
  const terms = [
    ...new Set(
      rest
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word))
    ),
  ].slice(0, 30);

  return { dois: doi ? [doi] : [], ids: [...new Set(ids)], terms };
}
