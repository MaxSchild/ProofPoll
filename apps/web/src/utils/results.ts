import type { PollAttentionCheck, PollQuestion } from '@/utils/polls';

export interface PollResponseRow {
  id: string;
  seq: number;
  createdAt: string;
  answers: Record<string, string>;
}

export interface OptionTally {
  option: string;
  count: number;
}

export interface QuestionTally {
  question: PollQuestion;
  options: OptionTally[];
  total: number;
}

/** How often each option of each question was chosen, in question order. */
export function tallyAnswers(
  questions: PollQuestion[],
  responses: PollResponseRow[]
): QuestionTally[] {
  return questions.map((question) => {
    const counts = new Map(question.options.map((option) => [option, 0]));
    let total = 0;
    for (const response of responses) {
      const answer = response.answers[question.id];
      if (answer !== undefined && counts.has(answer)) {
        counts.set(answer, (counts.get(answer) ?? 0) + 1);
        total += 1;
      }
    }
    return {
      question,
      options: question.options.map((option) => ({ option, count: counts.get(option) ?? 0 })),
      total,
    };
  });
}

/** Whether a response picked something other than the attention check's answer. */
export function failsAttentionCheck(
  response: PollResponseRow,
  check: PollAttentionCheck | null
): boolean {
  if (!check) return false;
  return response.answers[check.question_id] !== check.correct_option;
}

// Answers are written exactly as given (only quoted where CSV needs it): the
// dataset check compares these values with the record, so they must not be
// altered, e.g. by prefixing formula-like text.
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * The dataset as CSV: one row per answer in the order it arrived, with the
 * response id, the time it was saved (UTC, ISO 8601) and one column per
 * question id. This is the format the dataset check reads back later.
 */
export function responsesToCsv(questions: PollQuestion[], responses: PollResponseRow[]): string {
  const header = ['response_id', 'seq', 'submitted_at', ...questions.map((q) => q.id)];
  const rows = [...responses]
    .sort((a, b) => a.seq - b.seq)
    .map((response) => [
      response.id,
      String(response.seq),
      new Date(response.createdAt).toISOString(),
      ...questions.map((q) => response.answers[q.id] ?? ''),
    ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
