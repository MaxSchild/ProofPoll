import 'server-only';

import { extractIdentifiers, type PaperIdentifiers } from '@/lib/mocks/identifier-extraction';
import { createSupabaseClient } from '@/supabase-clients/server';
import type { PollAuthor } from '@/utils/polls';
import type { StudySummary } from '@/utils/verification';

// Reads for reviewers and the public. Everything comes from the database's
// gated functions: aggregates only, never individual answers.

export interface ReviewVersion {
  title: string;
  authorCount: number;
  version: number;
  manuscriptSha256: string;
  confirmedAt: string;
  studies: StudySummary[];
}

export interface PublishedPaper {
  id: string;
  title: string;
  authors: PollAuthor[];
  doi: string;
  publishedAt: string;
  autoMatched: boolean;
  resultsPublic: boolean;
  version: number;
  manuscriptSha256: string;
  confirmedAt: string;
  studies: StudySummary[];
}

export interface PaperCandidate {
  id: string;
  title: string;
  authors: PollAuthor[];
  doi: string | null;
  publishedAt: string | null;
}

/** The confirmed review round behind this unlisted link, or null. */
export async function getReviewVersion(token: string): Promise<ReviewVersion | null> {
  if (!/^[A-Za-z0-9]{24}$/.test(token)) return null;
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc('get_review_version', { p_token: token });
  if (error) throw error;
  if (!data) return null;
  const review = data as Record<string, unknown>;

  return {
    title: review.title as string,
    authorCount: review.author_count as number,
    version: review.version as number,
    manuscriptSha256: review.manuscript_sha256 as string,
    confirmedAt: review.confirmed_at as string,
    studies: review.studies as StudySummary[],
  };
}

/** The published paper with this id, or null. */
export async function getPublishedPaper(id: string): Promise<PublishedPaper | null> {
  if (!/^[A-Za-z0-9]{8}$/.test(id)) return null;
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc('get_published_paper', { p_id: id });
  if (error) throw error;
  if (!data) return null;
  const paper = data as Record<string, unknown>;

  return {
    id: paper.id as string,
    title: paper.title as string,
    authors: paper.authors as PollAuthor[],
    doi: paper.doi as string,
    publishedAt: paper.published_at as string,
    autoMatched: paper.auto_matched as boolean,
    resultsPublic: paper.results_public as boolean,
    version: paper.version as number,
    manuscriptSha256: paper.manuscript_sha256 as string,
    confirmedAt: paper.confirmed_at as string,
    studies: paper.studies as StudySummary[],
  };
}

/**
 * Published papers matching whatever someone pasted: a DOI, a title,
 * authors, a citation or a ProofPoll link. The identifiers are extracted
 * by a mock of the LLM step (lib/mocks/identifier-extraction.ts).
 */
export async function searchPapers(
  text: string
): Promise<{ identifiers: PaperIdentifiers; candidates: PaperCandidate[] }> {
  const identifiers = extractIdentifiers(text);
  if (
    identifiers.dois.length === 0 &&
    identifiers.ids.length === 0 &&
    identifiers.terms.length === 0
  ) {
    return { identifiers, candidates: [] };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc('search_published_papers', {
    p_dois: identifiers.dois,
    p_ids: identifiers.ids,
    p_terms: identifiers.terms,
  });
  if (error) throw error;

  return {
    identifiers,
    candidates: data.map((paper) => ({
      id: paper.id,
      title: paper.title,
      authors: paper.authors as unknown as PollAuthor[],
      doi: paper.doi,
      publishedAt: paper.published_at,
    })),
  };
}
