import 'server-only';

import type { PollAttentionCheck, PollExclusionRules, PollQuestion } from '@/utils/polls';
import { failsAttentionCheck, tallyAnswers, type PollResponseRow } from '@/utils/results';
import { toPercentages, type ReportedNumbers } from '@/utils/verification';

/*
 * MOCK: manuscript extraction (prototype spec §12.2, step 3).
 *
 * Real version: the uploaded PDF goes to an LLM, which finds each study in
 * the manuscript, maps it to one of the paper's polls, and extracts the
 * reported N, the number of exclusions and the key results (percent per
 * option). The file is deleted afterwards; only its SHA-256 is kept.
 *
 * Here: the file never leaves the browser (only its SHA-256 and name are
 * sent), and the "extracted" numbers are plausible values derived from the
 * record itself: N after the registered exclusions, the number excluded, and
 * the percentages of the first question that isn't the attention check. The
 * researcher confirms or corrects them, so a demo can still show what an
 * inconsistent paper looks like.
 */

export interface ManuscriptFile {
  sha256: string;
  fileName: string;
}

export interface StudyRecord {
  pollId: string;
  questions: PollQuestion[];
  exclusionRules: PollExclusionRules;
  attentionCheck: PollAttentionCheck | null;
  responses: PollResponseRow[];
}

export async function extractReportedNumbers(
  _manuscript: ManuscriptFile,
  studies: StudyRecord[]
): Promise<Record<string, ReportedNumbers>> {
  return Object.fromEntries(
    studies.map((study) => {
      const check = study.exclusionRules.exclude_failed_attention_check
        ? study.attentionCheck
        : null;
      const kept = study.responses.filter((response) => !failsAttentionCheck(response, check));
      const question = study.questions.find((q) => q.id !== study.attentionCheck?.question_id);
      const reportedResults: ReportedNumbers['reported_results'] = {};
      if (question && kept.length > 0) {
        const [tally] = tallyAnswers([question], kept);
        reportedResults[question.id] = toPercentages(
          Object.fromEntries(tally.options.map(({ option, count }) => [option, count])),
          kept.length
        );
      }
      return [
        study.pollId,
        {
          reported_n: kept.length,
          reported_exclusions: study.responses.length - kept.length,
          reported_results: reportedResults,
        },
      ];
    })
  );
}
