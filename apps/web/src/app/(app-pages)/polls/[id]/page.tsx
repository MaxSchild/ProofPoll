import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PollStatusBadge } from '@/components/poll-status-badge';
import { getPoll } from '@/data/user/polls';
import { PollOverview } from './_components/poll-overview';
import { PollTabs } from './_components/poll-tabs';

export const metadata: Metadata = { title: 'Poll · AllCounted' };

export default async function PollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const poll = await getPoll(id);
  if (!poll) notFound();

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
        <PollTabs overview={<PollOverview poll={poll} />} />
      </Suspense>
    </div>
  );
}
