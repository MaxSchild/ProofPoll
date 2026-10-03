// Fingerprints written to Solana (spec §6.1) and the memo format that carries
// them (§6.2). Used by the server when recording and by the dataset check, so
// both sides hash exactly the same bytes. Works in Node and in the browser.

export const MEMO_PREFIX = 'AC1';

export interface PlanForFingerprint {
  title: string;
  description: string;
  planned_n: number | null;
  questions: unknown;
  exclusion_rules: unknown;
}

/**
 * JSON with object keys sorted at every level and no whitespace. Array order
 * is kept (question and option order are part of the plan).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** No salt: the plan is public, so anyone can recompute this. */
export function planHash(plan: PlanForFingerprint): Promise<string> {
  return sha256Hex(
    canonicalJson({
      title: plan.title,
      description: plan.description,
      planned_n: plan.planned_n,
      questions: plan.questions,
      exclusion_rules: plan.exclusion_rules,
    })
  );
}

/** One answer's fingerprint. The salt keeps the answers unguessable. */
export function leafHash(input: {
  pollId: string;
  responseId: string;
  answers: Record<string, string>;
  saltHex: string;
}): Promise<string> {
  return sha256Hex(
    [MEMO_PREFIX, input.pollId, input.responseId, canonicalJson(input.answers), input.saltHex].join(
      '|'
    )
  );
}

export function planMemo(pollId: string, hash: string): string {
  return `${MEMO_PREFIX} plan ${pollId} ${hash}`;
}

export function answerMemo(pollId: string, seq: number, hash: string): string {
  return `${MEMO_PREFIX} ans ${pollId} ${seq} ${hash}`;
}

export type ParsedMemo =
  | { kind: 'plan'; pollId: string; hash: string }
  | { kind: 'ans'; pollId: string; seq: number; hash: string };

/**
 * Reads one of our memos. RPC nodes report memos as "[<length>] <text>",
 * and several memos in one transaction are joined with "; ", so the prefix
 * is optional and only our own memo is matched.
 */
export function parseMemo(raw: string): ParsedMemo | null {
  const match = raw.match(
    /(?:^|\]\s|;\s)AC1 (plan|ans) ([A-Za-z0-9]{1,20}) (?:(\d+) )?([0-9a-f]{64})(?:$|;)/
  );
  if (!match) return null;
  const [, kind, pollId, seq, hash] = match;
  if (kind === 'plan' && seq === undefined) return { kind, pollId, hash };
  if (kind === 'ans' && seq !== undefined) return { kind, pollId, seq: Number(seq), hash };
  return null;
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF line ends. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => !(cells.length === 1 && cells[0] === ''));
}
