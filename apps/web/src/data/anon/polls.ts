'use server';

import { actionClient } from '@/lib/safe-action';
import { createSupabaseClient } from '@/supabase-clients/server';
import { toUserError } from '@/utils/db-errors';
import { UserFacingError } from '@/utils/user-facing-error';
import { submitResponseSchema } from '@/utils/zod-schemas/answer';
import { revalidatePath } from 'next/cache';

/**
 * Stores one participant's answers. submit_response checks that the poll is
 * open and that every question has exactly one of its options; its messages
 * ("This poll is not accepting answers") are shown to the participant.
 */
export const submitResponseAction = actionClient
  .schema(submitResponseSchema)
  .action(async ({ parsedInput: { pollId, answers } }) => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.rpc('submit_response', {
      p_poll_id: pollId,
      p_answers: answers,
    });
    if (error) {
      throw toUserError(
        error,
        "Your answer wasn't saved. Check your connection and try again."
      );
    }
    const response = data[0];
    if (!response) {
      throw new UserFacingError(
        "Your answer wasn't saved. Check your connection and try again."
      );
    }
    revalidatePath('/dashboard');
    revalidatePath(`/polls/${pollId}`);
    return {
      id: response.id,
      seq: response.seq,
      createdAt: response.created_at,
    };
  });
