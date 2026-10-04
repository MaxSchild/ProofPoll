import 'server-only';

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

// Records are SPL Memo transactions on devnet (spec §6.2). The service key
// pays the fee; the poll's record key co-signs, so the explorer page of the
// record key lists every record of that poll.

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const DEFAULT_RPC_URL = 'https://api.devnet.solana.com';
const CONFIRM_TIMEOUT_MS = 20_000;
const CONFIRM_POLL_MS = 800;

let connection: Connection | null = null;

export function getConnection(): Connection {
  connection ??= new Connection(process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL, 'confirmed');
  return connection;
}

/** False when SOLANA_SERVICE_KEY is unset (e.g. in e2e tests): nothing is recorded. */
export function isSolanaConfigured(): boolean {
  return Boolean(process.env.SOLANA_SERVICE_KEY);
}

let serviceKey: Keypair | null = null;

/** SOLANA_SERVICE_KEY holds the secret key as a JSON byte array (solana-keygen format). */
function getServiceKey(): Keypair {
  if (serviceKey) return serviceKey;
  const raw = process.env.SOLANA_SERVICE_KEY;
  if (!raw) throw new Error('SOLANA_SERVICE_KEY is not set');
  serviceKey = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  return serviceKey;
}

export function newRecordKey(): { publicKey: string; secret: string } {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    secret: Buffer.from(keypair.secretKey).toString('base64'),
  };
}

function recordKeyFromSecret(secret: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(Buffer.from(secret, 'base64')));
}

export class MemoNotConfirmedError extends Error {
  constructor(readonly signature: string) {
    super(`Memo transaction ${signature} was not confirmed in time`);
    this.name = 'MemoNotConfirmedError';
  }
}

/** The transaction landed but failed on chain; sending it again may succeed. */
export class MemoFailedError extends Error {
  constructor(readonly signature: string) {
    super(`Memo transaction ${signature} failed`);
    this.name = 'MemoFailedError';
  }
}

/**
 * Sends one memo signed by the service key and the record key, and waits
 * until it is confirmed. Confirmation is polled over HTTP rather than a
 * websocket subscription, which serverless functions handle badly.
 * onSent receives the signature before confirmation, so it can be stored
 * even when confirming times out.
 */
export async function sendMemo(
  memo: string,
  recordSecret: string,
  onSent?: (signature: string) => Promise<void>
): Promise<string> {
  const conn = getConnection();
  const payer = getServiceKey();
  const recordKey = recordKeyFromSecret(recordSecret);

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const transaction = new Transaction({
    feePayer: payer.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: recordKey.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from(memo, 'utf-8'),
    })
  );
  transaction.sign(payer, recordKey);

  const signature = await conn.sendRawTransaction(transaction.serialize(), {
    preflightCommitment: 'confirmed',
  });
  await onSent?.(signature);

  // From here on the transaction may land, so every way out reports its
  // signature and the caller never sends a second copy. A rate-limited
  // status check (429) just waits for the next poll.
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_POLL_MS));
    const status = await conn
      .getSignatureStatuses([signature])
      .then(({ value }) => value[0])
      .catch(() => undefined);
    if (status?.err) throw new MemoFailedError(signature);
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
      return signature;
    }
  }
  throw new MemoNotConfirmedError(signature);
}

/**
 * What became of a transaction sent earlier: confirmed, unknown to the
 * cluster (its blockhash expired, so it can no longer land), or 'unknown'
 * when the RPC couldn't be asked.
 */
export async function sentStatus(signature: string): Promise<'confirmed' | 'missing' | 'unknown'> {
  try {
    const { value } = await getConnection().getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = value[0];
    if (!status || status.err) return 'missing';
    return status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized'
      ? 'confirmed'
      : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Every memo co-signed by a record key, newest first (up to 1000). */
export async function readRecordMemos(
  recordPubkey: string
): Promise<{ signature: string; memo: string | null; blockTime: number | null }[]> {
  const signatures = await getConnection().getSignaturesForAddress(new PublicKey(recordPubkey), {
    limit: 1000,
  });
  return signatures
    .filter((entry) => !entry.err)
    .map((entry) => ({
      signature: entry.signature,
      memo: entry.memo,
      blockTime: entry.blockTime ?? null,
    }));
}
