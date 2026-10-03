import type { PollAttentionCheck, PollExclusionRules, PollQuestion } from '@/utils/polls';

// Shapes written by the database's validate_study() and read back by the
// researcher, review and public pages.

export type PaperStatus = 'draft' | 'in_review' | 'published';
export type Verdict = 'consistent' | 'inconsistent' | 'not_checkable';
export type LevelVerdict = 'consistent' | 'inconsistent';

export interface CountCheck {
  ran: boolean;
  recorded: number;
  excluded_by_rule: number;
  expected?: number;
  reported_n?: number;
  reported_exclusions?: number | null;
  /** expected - reported_n: > 0 answers unaccounted for, < 0 more reported than recorded */
  gap?: number;
  verdict?: LevelVerdict;
}

export interface ResultsCheckItem {
  question_id: string;
  option: string;
  reported: number;
  recorded: number;
  ok: boolean;
}

export interface ResultsCheck {
  ran: boolean;
  base?: number;
  tolerance?: number;
  items?: ResultsCheckItem[];
  verdict?: LevelVerdict;
}

export interface StudyValidation {
  verdict: Verdict;
  levels_run: string[];
  details: {
    count: CountCheck;
    results: ResultsCheck;
    dataset: { ran: boolean };
  };
}

/** {"q1": {"Coffee": 57, "Tea": 43}}: percent per option, per question. */
export type ReportedResults = Record<string, Record<string, number>>;

export interface ReportedNumbers {
  reported_n: number | null;
  reported_exclusions: number | null;
  reported_results: ReportedResults;
}

/** One study as the review and public pages receive it (study_summary()). */
export interface StudySummary {
  poll_id: string;
  title: string;
  description: string;
  planned_n: number | null;
  questions: PollQuestion[];
  exclusion_rules: PollExclusionRules;
  attention_check: PollAttentionCheck | null;
  opened_at: string | null;
  closed_at: string | null;
  recorded: number;
  first_answer_at: string | null;
  last_answer_at: string | null;
  reported: ReportedNumbers;
  validation: StudyValidation | null;
  /** Option counts per question; only when the researcher opted in. */
  results: Record<string, Record<string, number>> | null;
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  consistent: 'Consistent',
  inconsistent: 'Inconsistent',
  not_checkable: 'Not checkable',
};

export const LEVEL_LABELS: Record<string, string> = {
  count: 'Count check',
  results: 'Results check',
  dataset: 'Dataset check',
};

export const PAPER_STATUS_LABELS: Record<PaperStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The count check in one line, e.g.
 * "Recorded 100 · rule excludes 6 · paper reports 94 → consistent".
 */
export function describeCountCheck(count: CountCheck): string {
  if (!count.ran || count.reported_n === undefined) {
    return `Recorded ${count.recorded} · the paper reports no N`;
  }
  const parts = [`Recorded ${count.recorded}`];
  if (count.excluded_by_rule > 0) parts.push(`rule excludes ${count.excluded_by_rule}`);
  parts.push(`paper reports ${count.reported_n}`);
  return `${parts.join(' · ')} → ${count.verdict === 'consistent' ? 'consistent' : 'inconsistent'}`;
}

/** What the gap means, or null when there is none. */
export function describeCountGap(count: CountCheck): string | null {
  if (!count.ran || !count.gap) return null;
  if (count.gap > 0) {
    return `${plural(count.gap, 'answer', 'answers')} unaccounted for: the paper reports fewer than the record holds after the registered exclusions.`;
  }
  return `The paper reports ${plural(-count.gap, 'answer', 'answers')} more than the record holds after the registered exclusions.`;
}

/**
 * Whether the paper's own exclusion count differs from what the registered
 * rules exclude. Not part of the verdict, but worth showing.
 */
export function describeExclusionNote(count: CountCheck): string | null {
  if (!count.ran || count.reported_exclusions == null) return null;
  if (count.reported_exclusions === count.excluded_by_rule) return null;
  return `The paper states ${plural(count.reported_exclusions, 'exclusion', 'exclusions')}; the registered rules exclude ${count.excluded_by_rule}.`;
}

/** "Author 1, Author 2, Author 3" for blind review. */
export function anonymousAuthors(count: number): string {
  if (count <= 0) return 'Not stated';
  return Array.from({ length: count }, (_, index) => `Author ${index + 1}`).join(', ');
}

const DOI_PATTERN = /\b(10\.\d{4,9}\/[^\s"<>]+)/i;

/**
 * The DOI in a string, in lower case, from a bare DOI, a "doi:" prefix or a
 * doi.org link. Trailing punctuation from a citation is dropped.
 */
export function parseDoi(input: string): string | null {
  const match = input.match(DOI_PATTERN);
  if (!match) return null;
  return match[1].replace(/[.,;:)\]]+$/, '').toLowerCase();
}

/** Counts per option, as percentages of the base, rounded to whole percent. */
export function toPercentages(
  counts: Record<string, number>,
  base: number
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).map(([option, count]) => [
      option,
      base > 0 ? Math.round((count / base) * 100) : 0,
    ])
  );
}
