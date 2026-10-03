import 'server-only';

import { createSupabaseClient } from '@/supabase-clients/server';
import type { PollAuthor, PollQuestion, PollStatus } from '@/utils/polls';
import type {
  PaperStatus,
  ReportedNumbers,
  ReportedResults,
  StudyValidation,
  Verdict,
} from '@/utils/verification';

// Reads for the researcher's paper pages. Kept out of the 'use server'
// actions module so they are never exposed as callable server actions.

export interface PaperListItem {
  id: string;
  title: string;
  status: PaperStatus;
  doi: string | null;
  pollCount: number;
  versionCount: number;
  hasPendingMatch: boolean;
  createdAt: string;
}

export interface PaperPoll {
  id: string;
  title: string;
  status: PollStatus;
  plannedN: number | null;
  answerCount: number;
  questions: PollQuestion[];
}

export interface VersionStudy {
  pollId: string;
  reported: ReportedNumbers;
  validation: StudyValidation | null;
}

export interface PaperVersion {
  id: string;
  version: number;
  reviewToken: string;
  manuscriptSha256: string;
  manuscriptName: string;
  createdAt: string;
  confirmedAt: string | null;
  studies: VersionStudy[];
}

export interface DoiMatch {
  id: string;
  doi: string;
  matchedTitle: string;
  source: 'crossref' | 'openalex';
  reason: 'cites_link' | 'title_authors';
  matchedAt: string;
  confirmBy: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'auto_published';
}

export interface PaperDetails {
  id: string;
  title: string;
  authors: PollAuthor[];
  status: PaperStatus;
  doi: string | null;
  publishedAt: string | null;
  autoMatched: boolean;
  resultsPublic: boolean;
  createdAt: string;
  polls: PaperPoll[];
  /** Newest first. */
  versions: PaperVersion[];
  matches: DoiMatch[];
}

export interface SelectablePoll {
  id: string;
  title: string;
  status: PollStatus;
  answerCount: number;
}

async function currentUserId(): Promise<string> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) throw new Error('User not logged in');
  return data.claims.sub;
}

export async function getMyPapers(): Promise<PaperListItem[]> {
  const userId = await currentUserId();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from('papers')
    .select('id, title, status, doi, created_at, polls(count), paper_versions(confirmed_at), doi_matches(status)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return data.map((paper) => ({
    id: paper.id,
    title: paper.title,
    status: paper.status,
    doi: paper.doi,
    pollCount: paper.polls[0]?.count ?? 0,
    versionCount: paper.paper_versions.filter((v) => v.confirmed_at !== null).length,
    hasPendingMatch:
      paper.status === 'in_review' && paper.doi_matches.some((m) => m.status === 'pending'),
    createdAt: paper.created_at,
  }));
}

/** The paper with the given id, or null when it is not one of the user's. */
export async function getPaper(id: string): Promise<PaperDetails | null> {
  const userId = await currentUserId();
  const supabase = await createSupabaseClient();
  const { data: paper, error } = await supabase
    .from('papers')
    .select(
      `*,
      polls(id, title, status, planned_n, questions, opened_at, responses(count)),
      paper_versions(
        id, version, review_token, manuscript_sha256, manuscript_name, created_at, confirmed_at,
        version_study_numbers(poll_id, reported_n, reported_exclusions, reported_results),
        validation_results(poll_id, verdict, levels_run, details)
      ),
      doi_matches(*)`
    )
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!paper) return null;

  const polls = [...paper.polls].sort((a, b) =>
    (a.opened_at ?? '').localeCompare(b.opened_at ?? '') || a.id.localeCompare(b.id)
  );
  const pollOrder = new Map(polls.map((poll, index) => [poll.id, index]));

  return {
    id: paper.id,
    title: paper.title,
    authors: paper.authors as unknown as PollAuthor[],
    status: paper.status,
    doi: paper.doi,
    publishedAt: paper.published_at,
    autoMatched: paper.auto_matched,
    resultsPublic: paper.results_public,
    createdAt: paper.created_at,
    polls: polls.map((poll) => ({
      id: poll.id,
      title: poll.title,
      status: poll.status,
      plannedN: poll.planned_n,
      answerCount: poll.responses[0]?.count ?? 0,
      questions: poll.questions as unknown as PollQuestion[],
    })),
    versions: [...paper.paper_versions]
      .sort((a, b) => b.version - a.version)
      .map((version) => ({
        id: version.id,
        version: version.version,
        reviewToken: version.review_token,
        manuscriptSha256: version.manuscript_sha256,
        manuscriptName: version.manuscript_name,
        createdAt: version.created_at,
        confirmedAt: version.confirmed_at,
        studies: [...version.version_study_numbers]
          .sort((a, b) => (pollOrder.get(a.poll_id) ?? 0) - (pollOrder.get(b.poll_id) ?? 0))
          .map((study) => {
            const result = version.validation_results.find((r) => r.poll_id === study.poll_id);
            return {
              pollId: study.poll_id,
              reported: {
                reported_n: study.reported_n,
                reported_exclusions: study.reported_exclusions,
                reported_results: study.reported_results as unknown as ReportedResults,
              },
              validation: result
                ? {
                    verdict: result.verdict as Verdict,
                    levels_run: result.levels_run,
                    details: result.details as unknown as StudyValidation['details'],
                  }
                : null,
            };
          }),
      })),
    matches: [...paper.doi_matches]
      .sort((a, b) => b.matched_at.localeCompare(a.matched_at))
      .map((match) => ({
        id: match.id,
        doi: match.doi,
        matchedTitle: match.matched_title,
        source: match.source as DoiMatch['source'],
        reason: match.reason as DoiMatch['reason'],
        matchedAt: match.matched_at,
        confirmBy: match.confirm_by,
        status: match.status as DoiMatch['status'],
      })),
  };
}

/**
 * The user's opened and closed polls that can join this paper: those
 * without a paper, and those already in it.
 */
export async function getSelectablePolls(paperId: string | null): Promise<SelectablePoll[]> {
  // The id goes into a filter string below.
  if (paperId !== null && !/^[A-Za-z0-9]{8}$/.test(paperId)) return [];
  const userId = await currentUserId();
  const supabase = await createSupabaseClient();
  let query = supabase
    .from('polls')
    .select('id, title, status, paper_id, responses(count)')
    .eq('owner_id', userId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false });
  query = paperId
    ? query.or(`paper_id.is.null,paper_id.eq.${paperId}`)
    : query.is('paper_id', null);
  const { data, error } = await query;
  if (error) throw error;

  return data.map((poll) => ({
    id: poll.id,
    title: poll.title,
    status: poll.status,
    answerCount: poll.responses[0]?.count ?? 0,
  }));
}
