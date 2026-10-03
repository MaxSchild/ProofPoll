import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { getPollRecord } from '@/data/anon/record-queries';
import { CheckForm } from './check-form';

export const metadata: Metadata = { title: 'Check a dataset · AllCounted' };

async function Check({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getPollRecord(id);
  if (!record || record.status === 'draft') notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <Link href={`/s/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Public record
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Check a dataset</h1>
        <p className="text-muted-foreground">
          Upload the published CSV of <span className="font-medium text-foreground">{record.title}</span>.
          Every row is fingerprinted again and compared with the fingerprints read from Solana, so
          you can see which answers were changed, never recorded, or left out.
        </p>
      </header>
      <CheckForm
        pollId={id}
        questionIds={record.questions.map((question) => question.id)}
      />
    </div>
  );
}

export default function CheckPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10 sm:px-6" aria-busy="true">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <Check params={params} />
    </Suspense>
  );
}
