import { Lock } from 'lucide-react';
import { notFound } from 'next/navigation';

import { getPublicPoll } from '@/data/anon/poll-queries';
import { AnswerFlow } from './answer-flow';

export default async function AnswerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lab?: string | string[] }>;
}) {
  const { id } = await params;
  const { lab } = await searchParams;
  const poll = await getPublicPoll(id);
  if (!poll) notFound();

  if (poll.status === 'closed') {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-1 items-center px-4 py-6 sm:py-12">
        <div className="flex w-full flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Lock className="size-5" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            This poll isn&apos;t accepting answers.
          </h1>
          <p className="text-muted-foreground">
            If you think this is a mistake, contact the person who shared the link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-6 sm:py-12">
      <AnswerFlow
        poll={{
          id: poll.id,
          title: poll.title,
          description: poll.description,
          questions: poll.questions,
        }}
        lab={lab === '1'}
      />
    </div>
  );
}
