import type { PollQuestion } from '@/utils/polls';

export type Answers = Record<string, string>;

/** How many of the poll's questions have a chosen option. */
export function countAnswered(questions: PollQuestion[], answers: Answers): number {
  return questions.filter((question) => (answers[question.id] ?? '') !== '').length;
}

export function isComplete(questions: PollQuestion[], answers: Answers): boolean {
  return questions.length > 0 && countAnswered(questions, answers) === questions.length;
}

/** "Next participant in 12 s" */
export function formatCountdown(secondsLeft: number): string {
  return `Next participant in ${Math.max(0, Math.ceil(secondsLeft))} s`;
}

export interface StoredReceipt {
  seq: number;
  createdAt: string;
}

export const LAB_RESET_SECONDS = 15;

export function receiptStorageKey(pollId: string): string {
  return `allcounted:receipt:${pollId}`;
}

/** Parses what was saved in localStorage; anything unexpected gives null. */
export function parseStoredReceipt(raw: string | null): StoredReceipt | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { seq, createdAt } = value as Record<string, unknown>;
    if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) return null;
    if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return null;
    return { seq, createdAt };
  } catch {
    return null;
  }
}

/** Reads and writes the receipt; storage can be blocked, so never throw. */
export function loadReceipt(pollId: string): StoredReceipt | null {
  try {
    return parseStoredReceipt(window.localStorage.getItem(receiptStorageKey(pollId)));
  } catch {
    return null;
  }
}

export function saveReceipt(pollId: string, receipt: StoredReceipt): void {
  try {
    window.localStorage.setItem(receiptStorageKey(pollId), JSON.stringify(receipt));
  } catch {
    // Without storage the device simply isn't locked.
  }
}
