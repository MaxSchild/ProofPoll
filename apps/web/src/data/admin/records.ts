import 'server-only';

import { randomBytes } from 'node:crypto';

import {
  isSolanaConfigured,
  MemoFailedError,
  MemoNotConfirmedError,
  newRecordKey,
  sendMemo,
  sentStatus,
} from '@/lib/solana/memo';
import { createSupabaseAdminClient } from '@/supabase-clients/admin';
import { answerMemo, leafHash, planHash, planMemo } from '@/utils/fingerprints';

// Writes the Solana records (spec §6). Called from server actions after the
// caller's own client has done the permission-checked part (opening the poll,
// saving the answer); these functions only ever add records for rows that
// already exist. A failed record never fails the action that triggered it:
// the status is stored and the poll page offers a retry.

export type RecordStatus = 'pending' | 'recorded' | 'failed';

export interface RecordOutcome {
  status: RecordStatus | 'disabled';
  tx: string | null;
}

const DISABLED: RecordOutcome = { status: 'disabled', tx: null };

type Admin = ReturnType<typeof createSupabaseAdminClient>;

interface PollRecordRow {
  poll_id: string;
  record_pubkey: string;
  record_secret: string;
  plan_hash: string;
  plan_tx: string | null;
  status: RecordStatus;
}

/**
 * Sends a memo and stores the outcome through `save`. A transaction that was
 * sent but not confirmed in time keeps its signature as pending; one that was
 * sent earlier is checked first, so a retry does not record it twice.
 */
async function writeMemo(
  existingTx: string | null,
  memo: string,
  recordSecret: string,
  save: (fields: { status: RecordStatus; tx?: string; recorded_at?: string }) => Promise<void>
): Promise<RecordOutcome> {
  if (existingTx) {
    const earlier = await sentStatus(existingTx);
    if (earlier === 'confirmed') {
      await save({ status: 'recorded', tx: existingTx, recorded_at: new Date().toISOString() });
      return { status: 'recorded', tx: existingTx };
    }
    // It may still land: sending another copy could record it twice.
    if (earlier === 'unknown') return { status: 'pending', tx: existingTx };
  }
  // Retried once after a pause (spec §6.2) when sending itself failed: the
  // public devnet RPC answers bursts with 429s. Once a transaction is sent it
  // is not sent again; a later retry checks whether it landed (above).
  for (let attempt = 1; ; attempt += 1) {
    let sent = null as string | null;
    try {
      const tx = await sendMemo(memo, recordSecret, async (signature) => {
        sent = signature;
        await save({ status: 'pending', tx: signature });
      });
      await save({ status: 'recorded', tx, recorded_at: new Date().toISOString() });
      return { status: 'recorded', tx };
    } catch (error) {
      if (error instanceof MemoNotConfirmedError) {
        return { status: 'pending', tx: error.signature };
      }
      if (sent && !(error instanceof MemoFailedError)) {
        return { status: 'pending', tx: sent };
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      console.error('Solana record failed:', error);
      await save({ status: 'failed' }).catch(() => undefined);
      return { status: 'failed', tx: existingTx };
    }
  }
}

/** The poll's record key and plan fingerprint, created on first use. */
async function ensurePollRecord(admin: Admin, pollId: string): Promise<PollRecordRow> {
  const existing = await admin.from('poll_records').select('*').eq('poll_id', pollId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const poll = await admin
    .from('polls')
    .select('title, description, planned_n, questions, exclusion_rules, status')
    .eq('id', pollId)
    .single();
  if (poll.error) throw poll.error;
  if (poll.data.status === 'draft') throw new Error('A draft has no record');

  const key = newRecordKey();
  const inserted = await admin
    .from('poll_records')
    .upsert(
      {
        poll_id: pollId,
        record_pubkey: key.publicKey,
        record_secret: key.secret,
        plan_hash: await planHash(poll.data),
      },
      { onConflict: 'poll_id', ignoreDuplicates: true }
    )
    .select('*');
  if (inserted.error) throw inserted.error;
  if (inserted.data[0]) return inserted.data[0];

  // A concurrent call created it first.
  const again = await admin.from('poll_records').select('*').eq('poll_id', pollId).single();
  if (again.error) throw again.error;
  return again.data;
}

/** Records the plan of an open poll. Safe to call again. */
export async function recordPlan(pollId: string): Promise<RecordOutcome> {
  if (!isSolanaConfigured()) return DISABLED;
  const admin = createSupabaseAdminClient();
  try {
    const record = await ensurePollRecord(admin, pollId);
    if (record.status === 'recorded') return { status: 'recorded', tx: record.plan_tx };
    return await writeMemo(
      record.plan_tx,
      planMemo(pollId, record.plan_hash),
      record.record_secret,
      async ({ status, tx, recorded_at }) => {
        const { error } = await admin
          .from('poll_records')
          .update({ status, ...(tx ? { plan_tx: tx } : {}), ...(recorded_at ? { recorded_at } : {}) })
          .eq('poll_id', pollId);
        if (error) throw error;
      }
    );
  } catch (error) {
    console.error('Recording the plan failed:', error);
    return { status: 'failed', tx: null };
  }
}

/** Records one saved answer's fingerprint. Safe to call again. */
export async function recordAnswer(responseId: string): Promise<RecordOutcome> {
  if (!isSolanaConfigured()) return DISABLED;
  const admin = createSupabaseAdminClient();
  try {
    const response = await admin
      .from('responses')
      .select('id, poll_id, seq, answers')
      .eq('id', responseId)
      .single();
    if (response.error) throw response.error;
    const { poll_id: pollId, seq } = response.data;

    const pollRecord = await ensurePollRecord(admin, pollId);
    // The plan comes first on chain; an answer can still be recorded if the
    // plan's record failed, and the poll page shows that it needs a retry.
    if (pollRecord.status !== 'recorded') await recordPlan(pollId);

    let record = await admin
      .from('answer_records')
      .select('leaf_hash, tx, status')
      .eq('response_id', responseId)
      .maybeSingle();
    if (record.error) throw record.error;
    if (!record.data) {
      const salt = randomBytes(32).toString('hex');
      const hash = await leafHash({
        pollId,
        responseId,
        answers: response.data.answers as Record<string, string>,
        saltHex: salt,
      });
      const inserted = await admin
        .from('answer_records')
        .upsert(
          { response_id: responseId, poll_id: pollId, seq, salt, leaf_hash: hash },
          { onConflict: 'response_id', ignoreDuplicates: true }
        );
      if (inserted.error) throw inserted.error;
      record = await admin
        .from('answer_records')
        .select('leaf_hash, tx, status')
        .eq('response_id', responseId)
        .single();
      if (record.error) throw record.error;
    }
    const current = record.data!;
    if (current.status === 'recorded') return { status: 'recorded', tx: current.tx };

    return await writeMemo(
      current.tx,
      answerMemo(pollId, seq, current.leaf_hash),
      pollRecord.record_secret,
      async ({ status, tx, recorded_at }) => {
        const { error } = await admin
          .from('answer_records')
          .update({ status, ...(tx ? { tx } : {}), ...(recorded_at ? { recorded_at } : {}) })
          .eq('response_id', responseId);
        if (error) throw error;
      }
    );
  } catch (error) {
    console.error('Recording the answer failed:', error);
    return { status: 'failed', tx: null };
  }
}

/**
 * Retries the plan and every answer of a poll that isn't recorded yet,
 * one after another (devnet rate-limits bursts). Returns how many remain.
 */
export async function recordMissing(pollId: string): Promise<{ remaining: number }> {
  if (!isSolanaConfigured()) return { remaining: 0 };
  const admin = createSupabaseAdminClient();
  await recordPlan(pollId);

  const [responses, records] = await Promise.all([
    admin.from('responses').select('id').eq('poll_id', pollId).order('seq'),
    admin.from('answer_records').select('response_id, status').eq('poll_id', pollId),
  ]);
  if (responses.error) throw responses.error;
  if (records.error) throw records.error;
  const done = new Set(
    records.data.filter((row) => row.status === 'recorded').map((row) => row.response_id)
  );
  let remaining = 0;
  for (const { id } of responses.data) {
    if (done.has(id)) continue;
    const outcome = await recordAnswer(id);
    if (outcome.status !== 'recorded') remaining += 1;
  }
  return { remaining };
}
