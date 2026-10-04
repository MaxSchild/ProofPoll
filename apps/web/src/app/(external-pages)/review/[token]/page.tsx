import { EyeOff } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { ManuscriptCheck } from '@/components/verification/manuscript-check';
import { StudyRecord } from '@/components/verification/study-record';
import { getReviewVersion } from '@/data/anon/paper-queries';
import { formatDateTime } from '@/utils/format';
import { anonymousAuthors } from '@/utils/verification';
import { PRODUCT_NAME } from '@/constants';

// Unlisted: only people with the link can open it, and search engines are
// asked to stay away.
export const metadata: Metadata = {
  title: 'Review copy',
  robots: { index: false, follow: false },
};

async function Review({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const review = await getReviewVersion(token);
  if (!review) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <EyeOff className="size-4" aria-hidden="true" />
          Review copy · round {review.version} · unlisted
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{review.title}</h1>
        <p className="text-muted-foreground">Authors: {anonymousAuthors(review.authorCount)}</p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {PRODUCT_NAME} recorded every answer to the studies below as it arrived. The numbers the
          manuscript reports were confirmed by the authors on{' '}
          <time dateTime={review.confirmedAt}>{formatDateTime(review.confirmedAt)}</time> and
          checked against that record. Only totals are shown, never individual answers.
        </p>
      </header>

      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <ManuscriptCheck sha256={review.manuscriptSha256} />
      </div>

      {review.studies.map((study, index) => (
        <StudyRecord key={study.poll_id} study={study} index={index} />
      ))}
    </div>
  );
}

export default function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-10 sm:px-6" aria-busy="true">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <Review params={params} />
    </Suspense>
  );
}
