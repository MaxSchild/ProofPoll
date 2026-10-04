import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { AnswerRecordsTable, PlanRecord } from '@/components/record/record-view';
import { PollStatusBadge } from '@/components/poll-status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getAnswerRecords, getPollRecord } from '@/data/anon/record-queries';
import { formatDateTime } from '@/utils/format';

export const metadata: Metadata = { title: 'Public record' };

// The verifier's view (spec §3.4): the plan as registered, and every answer's
// fingerprint with its transaction on Solana devnet.
async function PublicRecord({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getPollRecord(id);
  if (!record || record.status === 'draft') notFound();
  const answers = await getAnswerRecords(id);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Public record</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
            {record.title}
          </h1>
          <PollStatusBadge status={record.status} />
        </div>
        <p className="font-mono text-2xl tabular-nums">
          {record.answerCount}
          {record.plannedN ? ` / ${record.plannedN}` : ''}{' '}
          <span className="font-sans text-sm text-muted-foreground">answers recorded</span>
        </p>
        {record.openedAt ? (
          <p className="text-sm text-muted-foreground">
            Opened <time dateTime={record.openedAt}>{formatDateTime(record.openedAt)}</time>
            {record.closedAt ? (
              <>
                {' · '}closed <time dateTime={record.closedAt}>{formatDateTime(record.closedAt)}</time>
              </>
            ) : null}
          </p>
        ) : null}
        <Button asChild>
          <Link href={`/s/${id}/check`}>Check a dataset against this record</Link>
        </Button>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Plan as registered</h2>
        <div className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
          {record.description ? (
            <p className="whitespace-pre-line">{record.description}</p>
          ) : null}
          <ol className="space-y-3">
            {record.questions.map((question, index) => (
              <li key={question.id}>
                <p className="font-medium">
                  {index + 1}. {question.text}
                </p>
                <p className="text-sm text-muted-foreground">{question.options.join(' · ')}</p>
              </li>
            ))}
          </ol>
          {record.exclusionRules.text || record.exclusionRules.exclude_failed_attention_check ? (
            <div className="text-sm">
              <p className="font-medium">Exclusion rules</p>
              {record.exclusionRules.text ? (
                <p className="whitespace-pre-line">{record.exclusionRules.text}</p>
              ) : null}
              {record.exclusionRules.exclude_failed_attention_check ? (
                <p className="text-muted-foreground">
                  Answers that fail the attention check are excluded.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <PlanRecord record={record} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Answers on Solana</h2>
        <p className="text-sm text-muted-foreground">
          Only fingerprints are public. Each one is a salted SHA-256 of one participant&apos;s
          answers, recorded on Solana devnet the moment the answer arrived.
        </p>
        <AnswerRecordsTable records={answers} />
      </section>
    </div>
  );
}

export default function PublicRecordPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-10 sm:px-6" aria-busy="true">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <PublicRecord params={params} />
    </Suspense>
  );
}
