import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AnswerRecord, PollRecord, RecordStatus } from '@/data/anon/record-queries';
import { explorerAddressUrl, explorerTxUrl } from '@/utils/fingerprints';
import { formatDateTime } from '@/utils/format';

// A poll's record on Solana: the plan's fingerprint and one fingerprint per
// answer, each with its devnet transaction. Shown to the owner (Record tab)
// and to everyone (/s/[id]); it contains nothing that isn't public on chain.

export function ExplorerLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"
    >
      {children}
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">(opens Solana Explorer in a new tab)</span>
    </a>
  );
}

function short(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function RecordStatusBadge({ status }: { status: RecordStatus | null }) {
  if (status === 'recorded') {
    return (
      <Badge className="border-transparent bg-success-soft text-success">Recorded</Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge className="border-transparent bg-destructive/10 text-destructive">Not recorded</Badge>
    );
  }
  return <Badge variant="outline">Pending</Badge>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function PlanRecord({ record }: { record: PollRecord }) {
  if (!record.recordPubkey || !record.planHash) {
    return (
      <p className="rounded-lg border bg-card p-4 text-muted-foreground sm:p-6">
        This poll has no record on Solana yet.
      </p>
    );
  }
  return (
    <dl className="divide-y rounded-lg border bg-card px-4 sm:px-6">
      <Row label="Plan registered">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <RecordStatusBadge status={record.planStatus} />
          {record.planRecordedAt ? (
            <time dateTime={record.planRecordedAt}>{formatDateTime(record.planRecordedAt)}</time>
          ) : null}
          {record.planTx ? (
            <ExplorerLink href={explorerTxUrl(record.planTx)}>View transaction</ExplorerLink>
          ) : null}
        </div>
      </Row>
      <Row label="Plan fingerprint">
        <code className="break-all font-mono text-sm">{record.planHash}</code>
        <p className="mt-1 text-sm text-muted-foreground">
          SHA-256 of the title, study plan, planned participants, questions and exclusion rules.
          Anyone can recompute it from the plan shown here.
        </p>
      </Row>
      <Row label="Record address">
        <code className="break-all font-mono text-sm">{record.recordPubkey}</code>
        <p className="mt-1">
          <ExplorerLink href={explorerAddressUrl(record.recordPubkey)}>
            See all records on Solana
          </ExplorerLink>
        </p>
      </Row>
    </dl>
  );
}

export function AnswerRecordsTable({ records }: { records: AnswerRecord[] }) {
  if (records.length === 0) {
    return <p className="text-muted-foreground">No answers recorded yet.</p>;
  }
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Answered</TableHead>
            <TableHead>Fingerprint</TableHead>
            <TableHead>Record</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.seq}>
              <TableCell className="font-mono tabular-nums">{record.seq}</TableCell>
              <TableCell className="whitespace-nowrap">
                <time dateTime={record.answeredAt}>{formatDateTime(record.answeredAt)}</time>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {record.leafHash ? short(record.leafHash) : '—'}
              </TableCell>
              <TableCell>
                {record.tx && record.status === 'recorded' ? (
                  <ExplorerLink href={explorerTxUrl(record.tx)}>Recorded</ExplorerLink>
                ) : (
                  <RecordStatusBadge status={record.status} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
