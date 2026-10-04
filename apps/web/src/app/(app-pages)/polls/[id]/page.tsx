import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PollStatusBadge } from '@/components/poll-status-badge';
import { getAnswerRecords, getPollRecord } from '@/data/anon/record-queries';
import { getPoll, getPollResponses } from '@/data/user/poll-queries';
import { toSiteURL } from '@/utils/helpers';
import { PollOverview } from './_components/poll-overview';
import { PollTabs } from './_components/poll-tabs';
import { RecordPanel } from './_components/record-panel';
import { ResultsPanel } from './_components/results-panel';
import { SharePanel } from './_components/share-panel';

export const metadata: Metadata = { title: 'Poll' };

export default async function PollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const poll = await getPoll(id);
  if (!poll) notFound();
  const [responses, record, answerRecords] = await Promise.all([
    getPollResponses(id),
    getPollRecord(id),
    getAnswerRecords(id),
  ]);
  const answerUrl = toSiteURL(`/p/${poll.id}`);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Dashboard
        </Link>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
              {poll.title}
            </h1>
            <PollStatusBadge status={poll.status} />
          </div>
          <p className="shrink-0 font-mono text-2xl tabular-nums sm:text-right">
            {poll.answerCount}
            {poll.plannedN ? ` / ${poll.plannedN}` : ''}{' '}
            <span className="font-sans text-sm text-muted-foreground">
              {poll.answerCount === 1 ? 'answer' : 'answers'}
            </span>
          </p>
        </header>
      </div>
      <Suspense fallback={null}>
        <PollTabs
          overview={<PollOverview poll={poll} />}
          share={
            <SharePanel
              pollId={poll.id}
              status={poll.status}
              answerUrl={answerUrl}
              labUrl={`${answerUrl}?lab=1`}
            />
          }
          results={
            <ResultsPanel
              pollId={poll.id}
              questions={poll.questions}
              attentionCheck={poll.attentionCheck}
              plannedN={poll.plannedN}
              responses={responses}
            />
          }
          record={
            <RecordPanel
              pollId={poll.id}
              status={poll.status}
              record={record}
              answers={answerRecords}
            />
          }
        />
      </Suspense>
    </div>
  );
}
