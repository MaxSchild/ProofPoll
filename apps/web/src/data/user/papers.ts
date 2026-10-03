'use server';

import type { Json } from '@/lib/database.types';
import { authActionClient } from '@/lib/safe-action';
import { findPublishedVersion } from '@/lib/mocks/literature-search';
import { extractReportedNumbers } from '@/lib/mocks/manuscript-extraction';
import { notifyResearcherOfMatch } from '@/lib/mocks/notifications';
import { createSupabaseClient } from '@/supabase-clients/server';
import { toUserError } from '@/utils/db-errors';
import type { PollAttentionCheck, PollExclusionRules, PollQuestion } from '@/utils/polls';
import { UserFacingError } from '@/utils/user-facing-error';
import type { ReportedNumbers, ReportedResults } from '@/utils/verification';
import {
  confirmNumbersSchema,
  doiMatchSchema,
  paperFormSchema,
  paperIdSchema,
  publishPaperSchema,
  respondToMatchSchema,
  resultsPublicSchema,
  startReviewRoundSchema,
  updatePaperSchema,
  versionIdSchema,
  type PaperFormValues,
  type StudyNumbersValues,
} from '@/utils/zod-schemas/paper';
import { revalidatePath } from 'next/cache';

function revalidatePaper(id: string) {
  revalidatePath('/my-papers');
  revalidatePath(`/my-papers/${id}`);
  revalidatePath(`/papers/${id}`);
}

/** Saves a draft paper and the set of its polls in one transaction (save_paper). */
async function savePaper(id: string | null, values: PaperFormValues): Promise<string> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc('save_paper', {
    // null creates a new paper; the generated types don't model SQL nulls.
    p_id: id as string,
    p_paper: {
      title: values.title.trim(),
      authors: values.authors
        .map((author) => ({ name: author.name.trim(), affiliation: author.affiliation.trim() }))
        .filter((author) => author.name !== ''),
    } as unknown as Json,
    p_poll_ids: values.pollIds,
  });
  if (error) throw toUserError(error, "The paper couldn't be saved. Try again.");
  return data;
}

export const createPaperAction = authActionClient
  .schema(paperFormSchema)
  .action(async ({ parsedInput }) => {
    const id = await savePaper(null, parsedInput);
    revalidatePath('/my-papers');
    return { id };
  });

export const updatePaperAction = authActionClient
  .schema(updatePaperSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...values } = parsedInput;
    await savePaper(id, values);
    revalidatePaper(id);
    return { id };
  });

export const deletePaperAction = authActionClient
  .schema(paperIdSchema)
  .action(async ({ parsedInput: { id } }) => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.from('papers').delete().eq('id', id).select('id');
    if (error) throw toUserError(error, "The paper couldn't be deleted.");
    if (data.length === 0) throw new UserFacingError('Only draft papers can be deleted.');
    revalidatePaper(id);
    return { id };
  });

/**
 * Starts a review round. The browser sends the manuscript's SHA-256 and file
 * name, not the file; the extraction is mocked (see
 * lib/mocks/manuscript-extraction.ts) and proposes numbers per poll, which
 * the researcher confirms next.
 */
export const startReviewRoundAction = authActionClient
  .schema(startReviewRoundSchema)
  .action(async ({ parsedInput: { paperId, sha256, fileName }, ctx: { userId } }) => {
    const supabase = await createSupabaseClient();
    // Check the paper before reading every answer of its polls.
    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .select('status')
      .eq('id', paperId)
      .eq('owner_id', userId)
      .maybeSingle();
    if (paperError) throw toUserError(paperError, "The manuscript couldn't be read. Try again.");
    if (!paper) throw new UserFacingError('This paper could not be found.');
    if (paper.status === 'published') {
      throw new UserFacingError('A published paper gets no new review rounds');
    }

    const { data: polls, error } = await supabase
      .from('polls')
      .select('id, questions, exclusion_rules, poll_attention_checks(question_id, correct_option), responses(id, seq, created_at, answers)')
      .eq('paper_id', paperId)
      .eq('owner_id', userId);
    if (error) throw toUserError(error, "The manuscript couldn't be read. Try again.");

    const extracted = await extractReportedNumbers(
      { sha256, fileName },
      polls.map((poll) => ({
        pollId: poll.id,
        questions: poll.questions as unknown as PollQuestion[],
        exclusionRules: poll.exclusion_rules as unknown as PollExclusionRules,
        attentionCheck: (poll.poll_attention_checks as PollAttentionCheck | null) ?? null,
        responses: poll.responses.map((response) => ({
          id: response.id,
          seq: response.seq,
          createdAt: response.created_at,
          answers: response.answers as Record<string, string>,
        })),
      }))
    );

    const { data: versionId, error: versionError } = await supabase.rpc('create_paper_version', {
      p_paper_id: paperId,
      p_sha256: sha256,
      p_name: fileName,
      p_extracted: extracted as unknown as Json,
    });
    if (versionError) {
      throw toUserError(versionError, "The review round couldn't be started. Try again.");
    }
    revalidatePaper(paperId);
    return { versionId };
  });

/** Form values to the database's shape: empty fields are "not reported". */
function toReportedNumbers(values: StudyNumbersValues): ReportedNumbers {
  const results: ReportedResults = {};
  for (const [questionId, options] of Object.entries(values.reportedResults)) {
    const given = Object.entries(options).filter(
      (entry): entry is [string, number] => entry[1] !== null
    );
    if (given.length > 0) results[questionId] = Object.fromEntries(given);
  }
  return {
    reported_n: values.reportedN,
    reported_exclusions: values.reportedExclusions,
    reported_results: results,
  };
}

/**
 * The researcher confirms the numbers; confirm_paper_version validates every
 * study against the record and activates the review link.
 */
export const confirmNumbersAction = authActionClient
  .schema(confirmNumbersSchema)
  .action(async ({ parsedInput: { versionId, studies } }) => {
    const supabase = await createSupabaseClient();
    const numbers = Object.fromEntries(
      Object.entries(studies).map(([pollId, values]) => [pollId, toReportedNumbers(values)])
    );
    const { error } = await supabase.rpc('confirm_paper_version', {
      p_version_id: versionId,
      p_numbers: numbers as unknown as Json,
    });
    if (error) throw toUserError(error, "The numbers couldn't be confirmed. Try again.");

    const { data } = await supabase
      .from('paper_versions')
      .select('paper_id')
      .eq('id', versionId)
      .maybeSingle();
    if (data) revalidatePaper(data.paper_id);
    return { versionId };
  });

export const discardVersionAction = authActionClient
  .schema(versionIdSchema)
  .action(async ({ parsedInput: { versionId } }) => {
    const supabase = await createSupabaseClient();
    const { data } = await supabase
      .from('paper_versions')
      .select('paper_id')
      .eq('id', versionId)
      .maybeSingle();
    const { error } = await supabase.rpc('discard_paper_version', { p_version_id: versionId });
    if (error) throw toUserError(error, "The upload couldn't be discarded. Try again.");
    if (data) revalidatePaper(data.paper_id);
    return { versionId };
  });

export const publishPaperAction = authActionClient
  .schema(publishPaperSchema)
  .action(async ({ parsedInput: { paperId, doi } }) => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from('papers')
      .update({ status: 'published', doi: doi.toLowerCase() })
      .eq('id', paperId)
      .select('id')
      .maybeSingle();
    if (error) throw toUserError(error, "The paper couldn't be published. Try again.");
    if (!data) throw new UserFacingError('This paper could not be found.');
    revalidatePaper(paperId);
    return { id: paperId };
  });

export const setResultsPublicAction = authActionClient
  .schema(resultsPublicSchema)
  .action(async ({ parsedInput: { paperId, resultsPublic } }) => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from('papers')
      .update({ results_public: resultsPublic })
      .eq('id', paperId)
      .select('id')
      .maybeSingle();
    if (error) throw toUserError(error, "The setting couldn't be saved. Try again.");
    if (!data) throw new UserFacingError('This paper could not be found.');
    revalidatePaper(paperId);
    return { resultsPublic };
  });

/**
 * One run of the daily literature check for this paper, on demand. The
 * search and the notification are mocked (lib/mocks/).
 */
export const runDetectionAction = authActionClient
  .schema(paperIdSchema)
  .action(async ({ parsedInput: { id }, ctx: { userId } }) => {
    const supabase = await createSupabaseClient();
    const { data: paper, error } = await supabase
      .from('papers')
      .select('id, title, status')
      .eq('id', id)
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) throw toUserError(error, "The check couldn't run. Try again.");
    if (!paper) throw new UserFacingError('This paper could not be found.');
    if (paper.status !== 'in_review') {
      throw new UserFacingError('Only papers in review are matched against published papers.');
    }

    const match = await findPublishedVersion(paper);
    if (!match) return { found: false };

    const { data: matchId, error: matchError } = await supabase.rpc('record_doi_match', {
      p_paper_id: id,
      p_doi: match.doi,
      p_title: match.title,
      p_source: match.source,
      p_reason: match.reason,
    });
    if (matchError) throw toUserError(matchError, "The check couldn't run. Try again.");
    // null: the researcher already said this DOI isn't theirs.
    if (!matchId) return { found: false };

    const { data: saved } = await supabase
      .from('doi_matches')
      .select('doi, confirm_by')
      .eq('id', matchId)
      .maybeSingle();
    if (saved) {
      await notifyResearcherOfMatch({ paperId: id, doi: saved.doi, confirmBy: saved.confirm_by });
    }
    revalidatePaper(id);
    return { found: true };
  });

async function paperOfMatch(matchId: string): Promise<string | null> {
  const supabase = await createSupabaseClient();
  const { data } = await supabase
    .from('doi_matches')
    .select('paper_id')
    .eq('id', matchId)
    .maybeSingle();
  return data?.paper_id ?? null;
}

export const respondToMatchAction = authActionClient
  .schema(respondToMatchSchema)
  .action(async ({ parsedInput: { matchId, confirm } }) => {
    const supabase = await createSupabaseClient();
    const { error } = await supabase.rpc('respond_to_doi_match', {
      p_match_id: matchId,
      p_confirm: confirm,
    });
    if (error) throw toUserError(error, "Your reply couldn't be saved. Try again.");
    const paperId = await paperOfMatch(matchId);
    if (paperId) revalidatePaper(paperId);
    return { confirm };
  });

/**
 * MOCK: stands in for 14 days passing without a reply, so the prototype can
 * show the automatic publication.
 */
export const expireMatchAction = authActionClient
  .schema(doiMatchSchema)
  .action(async ({ parsedInput: { matchId } }) => {
    const supabase = await createSupabaseClient();
    const { error } = await supabase.rpc('expire_doi_match_now', { p_match_id: matchId });
    if (error) throw toUserError(error, "That didn't work. Try again.");
    const paperId = await paperOfMatch(matchId);
    if (paperId) revalidatePaper(paperId);
    return { matchId };
  });
