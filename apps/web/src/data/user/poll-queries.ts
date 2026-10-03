import 'server-only';

import { createSupabaseClient } from '@/supabase-clients/server';
import type {
  PollAttentionCheck,
  PollAuthor,
  PollExclusionRules,
  PollQuestion,
  PollStatus,
} from '@/utils/polls';

// Reads for server components. Kept out of the 'use server' actions module so
// they are never exposed as callable server actions.

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
