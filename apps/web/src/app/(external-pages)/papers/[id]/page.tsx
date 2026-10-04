import { BadgeCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ManuscriptCheck } from '@/components/verification/manuscript-check';
import { StudyRecord } from '@/components/verification/study-record';
import { getPublishedPaper } from '@/data/anon/paper-queries';
import { formatDate, formatDateTime } from '@/utils/format';
import { PRODUCT_NAME } from '@/constants';

export const metadata: Metadata = { title: 'Published paper' };

async function Paper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = await getPublishedPaper(id);
  if (!paper) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <BadgeCheck className="size-4" aria-hidden="true" />
          Published paper
          {paper.autoMatched ? (
            <Badge variant="outline" className="text-muted-foreground">
              Matched automatically
            </Badge>
          ) : null}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{paper.title}</h1>
        {paper.authors.length > 0 ? (
          <p className="text-muted-foreground">
            {paper.authors
              .map((a) => (a.affiliation ? `${a.name} (${a.affiliation})` : a.name))
              .join(', ')}
          </p>
        ) : null}
        <p className="text-sm">
          DOI{' '}
          <a
            href={`https://doi.org/${paper.doi}`}
            className="font-mono underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            {paper.doi}
          </a>
          <span className="text-muted-foreground">
            {' '}
            · published <time dateTime={paper.publishedAt}>{formatDate(paper.publishedAt)}</time>
          </span>
        </p>
        {paper.autoMatched ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            We found this paper in Crossref or OpenAlex and the authors did not reply within 14
            days, so it was linked automatically.
          </p>
        ) : null}
        <p className="max-w-2xl text-sm text-muted-foreground">
          The verdicts below compare what the manuscript of review round {paper.version}{' '}
          (confirmed <time dateTime={paper.confirmedAt}>{formatDateTime(paper.confirmedAt)}</time>)
          reports with the answers {PRODUCT_NAME} recorded as they arrived.
        </p>
      </header>

      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <ManuscriptCheck sha256={paper.manuscriptSha256} />
      </div>

      {paper.studies.map((study, index) => (
        <StudyRecord key={study.poll_id} study={study} index={index} />
      ))}
    </div>
  );
}

export default function PublishedPaperPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-10 sm:px-6" aria-busy="true">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <Paper params={params} />
    </Suspense>
  );
}
