'use server';

import { z } from 'zod';

import { readRecordMemos } from '@/lib/solana/memo';
import { actionClient } from '@/lib/safe-action';
import { createSupabaseAdminClient } from '@/supabase-clients/admin';
import { leafHash, parseCsv, parseMemo, planHash } from '@/utils/fingerprints';
import { UserFacingError } from '@/utils/user-facing-error';
import { getPollRecord } from './record-queries';

// The dataset check (spec §6.4): anyone can upload a poll's published CSV and
// see whether it matches what was recorded on Solana as the answers arrived.
// The fingerprints are read from the chain, not from our database; only the
// salts come from us (the verifier trusts us for those, spec §10).

const MAX_CSV_CHARS = 2_000_000;

const checkDatasetSchema = z.object({
  pollId: z.string().regex(/^[A-Za-z0-9]{8}$/),
  csv: z.string().min(1).max(MAX_CSV_CHARS),
});

export type RowResult = 'ok' | 'changed' | 'not_recorded' | 'unverifiable';

export interface DatasetCheckResult {
  planOnChain: boolean;
  planMatches: boolean;
  recordedOnChain: number;
  rows: { responseId: string; seq: number | null; result: RowResult }[];
  missing: { seq: number; excludedByRule: boolean }[];
  counts: Record<RowResult | 'missing' | 'excluded_by_rule', number>;
  passed: boolean;
}

export const checkDatasetAction = actionClient
  .schema(checkDatasetSchema)
  .action(async ({ parsedInput: { pollId, csv } }): Promise<DatasetCheckResult> => {
    const poll = await getPollRecord(pollId);
    if (!poll || poll.status === 'draft') throw new UserFacingError('This poll could not be found.');
    if (!poll.recordPubkey) {
      throw new UserFacingError('This poll has no record on Solana yet.');
    }

    // 1. What is on chain, by answer number. A retried record can appear
    //    twice; any of its fingerprints counts.
    let memos;
    try {
      memos = await readRecordMemos(poll.recordPubkey);
    } catch {
      throw new UserFacingError("Solana couldn't be reached. Try again in a minute.");
    }
    const onChain = new Map<number, Set<string>>();
    let chainPlanHash: string | null = null;
    for (const { memo } of memos) {
      const parsed = memo ? parseMemo(memo) : null;
      if (!parsed || parsed.pollId !== pollId) continue;
      if (parsed.kind === 'plan') chainPlanHash = parsed.hash;
      else onChain.set(parsed.seq, (onChain.get(parsed.seq) ?? new Set()).add(parsed.hash));
    }
    const expectedPlanHash = await planHash({
      title: poll.title,
      description: poll.description,
      planned_n: poll.plannedN,
      questions: poll.questions,
      exclusion_rules: poll.exclusionRules,
    });

    // 2. The CSV: response_id plus one column per question id.
    const [header, ...body] = parseCsv(csv);
    if (!header) throw new UserFacingError('The file is empty.');
    const columns = header.map((cell) => cell.trim());
    const idColumn = columns.indexOf('response_id');
    const questionColumns = poll.questions.map((question) => ({
      id: question.id,
      index: columns.indexOf(question.id),
    }));
    if (idColumn === -1 || questionColumns.some((column) => column.index === -1)) {
      throw new UserFacingError(
        `The file needs the columns response_id, ${poll.questions.map((q) => q.id).join(', ')}.`
      );
    }

    // 3. Salts and stored answers (for the exclusion rule) from our database.
    const admin = createSupabaseAdminClient();
    const [records, responses, check] = await Promise.all([
      admin.from('answer_records').select('response_id, seq, salt').eq('poll_id', pollId),
      admin.from('responses').select('seq, answers').eq('poll_id', pollId),
      admin
        .from('poll_attention_checks')
        .select('question_id, correct_option')
        .eq('poll_id', pollId)
        .maybeSingle(),
    ]);
    if (records.error || responses.error || check.error) {
      throw new UserFacingError("The check couldn't run. Try again.");
    }
    const recordById = new Map(records.data.map((row) => [row.response_id, row]));

    const rows: DatasetCheckResult['rows'] = [];
    const seen = new Set<number>();
    for (const cells of body) {
      const responseId = (cells[idColumn] ?? '').trim();
      if (!responseId) continue;
      const record = recordById.get(responseId);
      if (!record) {
        rows.push({ responseId, seq: null, result: 'not_recorded' });
        continue;
      }
      seen.add(record.seq);
      const chainHashes = onChain.get(record.seq);
      if (!chainHashes) {
        rows.push({ responseId, seq: record.seq, result: 'not_recorded' });
        continue;
      }
      if (!record.salt) {
        rows.push({ responseId, seq: record.seq, result: 'unverifiable' });
        continue;
      }
      const answers = Object.fromEntries(
        questionColumns.map((column) => [column.id, cells[column.index] ?? ''])
      );
      const hash = await leafHash({ pollId, responseId, answers, saltHex: record.salt });
      rows.push({
        responseId,
        seq: record.seq,
        result: chainHashes.has(hash) ? 'ok' : 'changed',
      });
    }

    // 4. Records on chain with no row in the file. An answer that fails the
    //    attention check, when the registered rule excludes those, is
    //    excluded by rule rather than missing.
    const excludes = poll.exclusionRules.exclude_failed_attention_check === true && check.data;
    const answersBySeq = new Map(
      responses.data.map((row) => [row.seq, row.answers as Record<string, string>])
    );
    const missing = [...onChain.keys()]
      .filter((seq) => !seen.has(seq))
      .sort((a, b) => a - b)
      .map((seq) => {
        const answers = answersBySeq.get(seq);
        const excludedByRule = Boolean(
          excludes && answers && answers[check.data!.question_id] !== check.data!.correct_option
        );
        return { seq, excludedByRule };
      });

    const counts: DatasetCheckResult['counts'] = {
      ok: 0,
      changed: 0,
      not_recorded: 0,
      unverifiable: 0,
      missing: missing.filter((entry) => !entry.excludedByRule).length,
      excluded_by_rule: missing.filter((entry) => entry.excludedByRule).length,
    };
    for (const row of rows) counts[row.result] += 1;

    const planMatches = chainPlanHash === expectedPlanHash;
    return {
      planOnChain: chainPlanHash !== null,
      planMatches,
      recordedOnChain: onChain.size,
      rows,
      missing,
      counts,
      passed:
        planMatches && counts.changed === 0 && counts.not_recorded === 0 && counts.missing === 0,
    };
  });
