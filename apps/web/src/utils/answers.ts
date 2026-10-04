import type { PollQuestion } from '@/utils/polls';
import { PRODUCT_SLUG } from '@/constants';

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

export type ReceiptRecordStatus = 'recorded' | 'pending' | 'failed' | 'disabled';

export interface StoredReceipt {
  seq: number;
  createdAt: string;
  /** The answer's record on Solana; absent for receipts saved before it. */
  recordTx?: string | null;
  recordStatus?: ReceiptRecordStatus;
}

const RECORD_STATUSES: readonly string[] = ['recorded', 'pending', 'failed', 'disabled'];

export const LAB_RESET_SECONDS = 15;

export function receiptStorageKey(pollId: string): string {
  return `${PRODUCT_SLUG}:receipt:${pollId}`;
}

/** Parses what was saved in localStorage; anything unexpected gives null. */
export function parseStoredReceipt(raw: string | null): StoredReceipt | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { seq, createdAt, recordTx, recordStatus } = value as Record<string, unknown>;
    if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) return null;
    if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return null;
    const receipt: StoredReceipt = { seq, createdAt };
    if (typeof recordTx === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,90}$/.test(recordTx)) {
      receipt.recordTx = recordTx;
    }
    if (typeof recordStatus === 'string' && RECORD_STATUSES.includes(recordStatus)) {
      receipt.recordStatus = recordStatus as ReceiptRecordStatus;
    }
    return receipt;
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

/**
 * A random UUID (v4) for one filled-in form. crypto.randomUUID only exists in
 * secure contexts (HTTPS or localhost), so fall back to getRandomValues.
 */
export function newClientId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
