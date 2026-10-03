'use server';

import { recordMissing, recordPlan } from '@/data/admin/records';
import type { Json } from '@/lib/database.types';
import { authActionClient } from '@/lib/safe-action';
import { createSupabaseClient } from '@/supabase-clients/server';
import { toUserError } from '@/utils/db-errors';
import { buildPollPlan } from '@/utils/polls';
import { UserFacingError } from '@/utils/user-facing-error';
import {
  pollFormSchema,
  pollIdSchema,
  updatePollSchema,
  type PollFormValues,
} from '@/utils/zod-schemas/poll';
import { revalidatePath } from 'next/cache';

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

// Opening fixes the plan, so that is when its fingerprint goes on Solana.
// The poll is open either way; a failed record can be retried from the
// Record tab.
export const openPollAction = authActionClient
  .schema(pollIdSchema)
  .action(async ({ parsedInput: { id } }) => {
    await setStatus(id, 'open');
    const record = await recordPlan(id);
    revalidatePoll(id);
    return { id, record };
  });

/**
 * Records whatever of the user's poll isn't on Solana yet. Reading the poll
 * through the user's own client proves ownership (row-level security) before
 * the service-role writes start.
 */
export const recordMissingAction = authActionClient
  .schema(pollIdSchema)
  .action(async ({ parsedInput: { id } }) => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from('polls')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (error) throw toUserError(error, "The records couldn't be retried.");
    if (!data) throw new UserFacingError('This poll could not be found.');
    if (data.status === 'draft') throw new UserFacingError('A draft has nothing to record yet.');
    const result = await recordMissing(id);
    revalidatePoll(id);
    revalidatePath(`/s/${id}`);
    return result;
  });

export const closePollAction = authActionClient
  .schema(pollIdSchema)
  .action(async ({ parsedInput: { id } }) => setStatus(id, 'closed'));
