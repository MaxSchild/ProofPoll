import 'server-only';

import { createSupabaseClient } from '@/supabase-clients/server';
import type { PollQuestion } from '@/utils/polls';

// Reads for the public answer page. Only what a participant needs: never the
// owner, the authors or the attention check's correct answer.

export interface PublicPoll {
  id: string;
  title: string;
  description: string;
  questions: PollQuestion[];
  status: 'open' | 'closed';
}

/** The open or closed poll with this id, or null for drafts and unknown ids. */
export async function getPublicPoll(id: string): Promise<PublicPoll | null> {
  if (!/^[A-Za-z0-9]{8}$/.test(id)) return null;
  const supabase = await createSupabaseClient();
  // Polls are owner-only in the database; get_public_poll returns just the
  // fields above, and only for open and closed polls.
  const { data, error } = await supabase.rpc('get_public_poll', { p_id: id }).maybeSingle();
  if (error) throw error;
  if (!data || data.status === 'draft') return null;

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    questions: data.questions as unknown as PollQuestion[],
    status: data.status,
  };
}
