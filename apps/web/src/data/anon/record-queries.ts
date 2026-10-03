import 'server-only';

import { createSupabaseClient } from '@/supabase-clients/server';
import type { PollExclusionRules, PollQuestion, PollStatus } from '@/utils/polls';

// The public record of a poll (spec §3.4): the plan as registered, its
// fingerprint and every answer's fingerprint with its transaction. Never the
// answers, their salts or the record key's secret.

export type RecordStatus = 'pending' | 'recorded' | 'failed';

export interface PollRecord {
  id: string;
  title: string;
  description: string;
  plannedN: number | null;
  questions: PollQuestion[];
  exclusionRules: PollExclusionRules;
  status: PollStatus;
  openedAt: string | null;
  closedAt: string | null;
  answerCount: number;
  recordPubkey: string | null;
  planHash: string | null;
  planTx: string | null;
  planStatus: RecordStatus | null;
  planRecordedAt: string | null;
}

export interface AnswerRecord {
  seq: number;
  responseId: string;
  leafHash: string | null;
  tx: string | null;
  status: RecordStatus;
  answeredAt: string;
  recordedAt: string | null;
}

/** An open or closed poll's record (or the user's own draft), else null. */
export async function getPollRecord(id: string): Promise<PollRecord | null> {
  if (!/^[A-Za-z0-9]{8}$/.test(id)) return null;
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc('get_poll_record', { p_poll_id: id }).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.poll_id,
    title: data.title,
    description: data.description,
    plannedN: data.planned_n,
    questions: data.questions as unknown as PollQuestion[],
    exclusionRules: data.exclusion_rules as unknown as PollExclusionRules,
    status: data.status,
    openedAt: data.opened_at,
    closedAt: data.closed_at,
    answerCount: data.answer_count,
    recordPubkey: data.record_pubkey,
    planHash: data.plan_hash,
    planTx: data.plan_tx,
    planStatus: data.plan_status,
    planRecordedAt: data.plan_recorded_at,
  };
}

export async function getAnswerRecords(id: string): Promise<AnswerRecord[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc('get_answer_records', { p_poll_id: id });
  if (error) throw error;
  return data.map((row) => ({
    seq: row.seq,
    responseId: row.response_id,
    leafHash: row.leaf_hash,
    tx: row.tx,
    status: row.status,
    answeredAt: row.answered_at,
    recordedAt: row.recorded_at,
  }));
}
