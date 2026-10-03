'use server';

import type { Json } from '@/lib/database.types';
import { authActionClient } from '@/lib/safe-action';
import { createSupabaseClient } from '@/supabase-clients/server';
import { buildPollPlan } from '@/utils/polls';
import { UserFacingError } from '@/utils/user-facing-error';
import {
  pollFormSchema,
  pollIdSchema,
  updatePollSchema,
  type PollFormValues,
} from '@/utils/zod-schemas/poll';
import type { PostgrestError } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const CHECK_VIOLATION = '23514';

/**
 * The database's own rules raise check_violation with messages written for
 * people (for example "The plan of an opened poll cannot be changed"); those
 * are shown as they are. Table CHECK constraints share the error code but
 * name internal constraints, so they get the generic message like any other
 * error, which is logged.
 */
function toUserError(error: PostgrestError, fallback: string): Error {
  const isConstraintMessage =
    error.message.startsWith('new row for relation') ||
    error.message.includes('violates check constraint');
  if (error.code === CHECK_VIOLATION && !isConstraintMessage) {
    return new UserFacingError(error.message);
  }
  console.error('Poll query failed:', error);
  return new UserFacingError(fallback);
}

function revalidatePoll(id: string) {
  revalidatePath('/dashboard');
  revalidatePath(`/polls/${id}`);
}

/**
 * Saves a draft and its attention check in one database transaction
 * (save_poll), so a failure cannot leave a poll without its check.
 * Row-level security limits edits to the owner's drafts.
 */
async function savePoll(id: string | null, values: PollFormValues): Promise<string> {
  const plan = buildPollPlan(values);
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc('save_poll', {
    // null creates a new poll; the generated types don't model SQL nulls.
    p_id: id as string,
    p_poll: {
      title: plan.title,
      description: plan.description,
      planned_n: plan.planned_n,
      questions: plan.questions,
      exclusion_rules: plan.exclusion_rules,
      authors: plan.authors,
    } as unknown as Json,
    p_check: plan.attentionCheck as unknown as Json,
  });
  if (error) throw toUserError(error, "The poll couldn't be saved. Try again.");
  return data;
}

export const createPollAction = authActionClient
  .schema(pollFormSchema)
  .action(async ({ parsedInput }) => {
    const id = await savePoll(null, parsedInput);
    revalidatePath('/dashboard');
    return { id };
  });

export const updatePollAction = authActionClient
  .schema(updatePollSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...values } = parsedInput;
    await savePoll(id, values);
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
