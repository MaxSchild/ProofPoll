'use server';

import { authActionClient } from '@/lib/safe-action';
import { createSupabaseClient } from '@/supabase-clients/server';
import {
  buildPollPlan,
  type PollAttentionCheck,
  type PollAuthor,
  type PollExclusionRules,
  type PollQuestion,
  type PollStatus,
} from '@/utils/polls';
import { UserFacingError } from '@/utils/user-facing-error';
import {
  pollFormSchema,
  pollIdSchema,
  updatePollSchema,
} from '@/utils/zod-schemas/poll';
import type { PostgrestError } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const CHECK_VIOLATION = '23514';

/**
 * The database raises check_violation with messages written for people (for
 * example "The plan of an opened poll cannot be changed"). Those are shown as
 * they are. Anything else is logged and replaced by a generic message.
 */
function toUserError(error: PostgrestError, fallback: string): Error {
  if (error.code === CHECK_VIOLATION) return new UserFacingError(error.message);
  console.error('Poll query failed:', error);
  return new UserFacingError(fallback);
}

export interface PollListItem {
  id: string;
  title: string;
  status: PollStatus;
  plannedN: number | null;
  answerCount: number;
  createdAt: string;
}

export interface PollDetails extends PollListItem {
  description: string;
  questions: PollQuestion[];
  exclusionRules: PollExclusionRules;
  authors: PollAuthor[];
  attentionCheck: PollAttentionCheck | null;
  openedAt: string | null;
  closedAt: string | null;
}

async function currentUserId(): Promise<string> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) throw new Error('User not logged in');
  return data.claims.sub;
}

// Open and closed polls are readable by anyone, so reads must always filter on
// the owner. The answers are counted in the same query (an embedded count).
export async function getMyPolls(): Promise<PollListItem[]> {
  const userId = await currentUserId();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from('polls')
    .select('id, title, status, planned_n, created_at, responses(count)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return data.map((poll) => ({
    id: poll.id,
    title: poll.title,
    status: poll.status,
    plannedN: poll.planned_n,
    answerCount: poll.responses[0]?.count ?? 0,
    createdAt: poll.created_at,
  }));
}

/** The poll with the given id, or null when it is not one of the user's. */
export async function getPoll(id: string): Promise<PollDetails | null> {
  const userId = await currentUserId();
  const supabase = await createSupabaseClient();
  const [pollResult, checkResult] = await Promise.all([
    supabase
      .from('polls')
      .select('*, responses(count)')
      .eq('id', id)
      .eq('owner_id', userId)
      .maybeSingle(),
    supabase
      .from('poll_attention_checks')
      .select('question_id, correct_option')
      .eq('poll_id', id)
      .maybeSingle(),
  ]);
  if (pollResult.error) throw pollResult.error;
  if (checkResult.error) throw checkResult.error;
  const poll = pollResult.data;
  if (!poll) return null;

  return {
    id: poll.id,
    title: poll.title,
    status: poll.status,
    plannedN: poll.planned_n,
    answerCount: poll.responses[0]?.count ?? 0,
    createdAt: poll.created_at,
    description: poll.description,
    questions: poll.questions as unknown as PollQuestion[],
    exclusionRules: poll.exclusion_rules as unknown as PollExclusionRules,
    authors: poll.authors as unknown as PollAuthor[],
    attentionCheck: checkResult.data
      ? {
          question_id: checkResult.data.question_id,
          correct_option: checkResult.data.correct_option,
        }
      : null,
    openedAt: poll.opened_at,
    closedAt: poll.closed_at,
  };
}

function revalidatePoll(id: string) {
  revalidatePath('/dashboard');
  revalidatePath(`/polls/${id}`);
}

export const createPollAction = authActionClient
  .schema(pollFormSchema)
  .action(async ({ parsedInput }) => {
    const plan = buildPollPlan(parsedInput);
    const supabase = await createSupabaseClient();

    // owner_id defaults to auth.uid() and is enforced by RLS.
    const { data: poll, error } = await supabase
      .from('polls')
      .insert({
        title: plan.title,
        description: plan.description,
        planned_n: plan.planned_n,
        questions: plan.questions,
        exclusion_rules: plan.exclusion_rules,
        authors: plan.authors,
      })
      .select('id')
      .single();
    if (error) throw toUserError(error, "The poll couldn't be saved. Try again.");

    if (plan.attentionCheck) {
      const { error: checkError } = await supabase
        .from('poll_attention_checks')
        .insert({ poll_id: poll.id, ...plan.attentionCheck });
      if (checkError) {
        // Do not leave a draft without the check the researcher asked for.
        await supabase.from('polls').delete().eq('id', poll.id);
        throw toUserError(checkError, "The poll couldn't be saved. Try again.");
      }
    }

    revalidatePath('/dashboard');
    return { id: poll.id };
  });

export const updatePollAction = authActionClient
  .schema(updatePollSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...values } = parsedInput;
    const plan = buildPollPlan(values);
    const supabase = await createSupabaseClient();
    const failed = "The poll couldn't be saved. Try again.";

    const { data: previousCheck, error: readError } = await supabase
      .from('poll_attention_checks')
      .select('poll_id, question_id, correct_option')
      .eq('poll_id', id)
      .maybeSingle();
    if (readError) throw toUserError(readError, failed);

    // The database checks the attention check against the current questions,
    // so it is removed first, the poll updated, and the new check added last.
    if (previousCheck) {
      const { error } = await supabase
        .from('poll_attention_checks')
        .delete()
        .eq('poll_id', id);
      if (error) throw toUserError(error, failed);
    }

    const restorePreviousCheck = async () => {
      if (previousCheck) {
        await supabase.from('poll_attention_checks').insert(previousCheck);
      }
    };

    const { data: updated, error } = await supabase
      .from('polls')
      .update({
        title: plan.title,
        description: plan.description,
        planned_n: plan.planned_n,
        questions: plan.questions,
        exclusion_rules: plan.exclusion_rules,
        authors: plan.authors,
      })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error || !updated) {
      await restorePreviousCheck();
      if (error) throw toUserError(error, failed);
      throw new UserFacingError('This poll could not be found.');
    }

    if (plan.attentionCheck) {
      const { error: checkError } = await supabase
        .from('poll_attention_checks')
        .insert({ poll_id: id, ...plan.attentionCheck });
      if (checkError) {
        throw toUserError(checkError, failed);
      }
    }

    revalidatePoll(id);
    return { id };
  });

export const deletePollAction = authActionClient
  .schema(pollIdSchema)
  .action(async ({ parsedInput: { id } }) => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from('polls')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw toUserError(error, "The draft couldn't be deleted.");
    if (data.length === 0) {
      throw new UserFacingError('Only drafts can be deleted.');
    }
    revalidatePoll(id);
    return { id };
  });

async function setStatus(id: string, status: 'open' | 'closed') {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from('polls')
    .update({ status })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) {
    throw toUserError(
      error,
      status === 'open'
        ? "The poll couldn't be opened. Try again."
        : "The poll couldn't be closed. Try again."
    );
  }
  if (!data) throw new UserFacingError('This poll could not be found.');
  revalidatePoll(id);
  return { id };
}

export const openPollAction = authActionClient
  .schema(pollIdSchema)
  .action(async ({ parsedInput: { id } }) => setStatus(id, 'open'));

export const closePollAction = authActionClient
  .schema(pollIdSchema)
  .action(async ({ parsedInput: { id } }) => setStatus(id, 'closed'));
