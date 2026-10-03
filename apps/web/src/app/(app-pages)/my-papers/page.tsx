import { FileText, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { PaperStatusBadge } from '@/components/verification/paper-status-badge';
import { getMyPapers } from '@/data/user/paper-queries';
import { formatDate } from '@/utils/format';

export const metadata: Metadata = { title: 'Your papers · AllCounted' };

async function PaperList() {
  const papers = await getMyPapers();

  if (papers.length === 0) {
    return (
      <Empty className="flex-none border bg-card py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="rounded-full">
            <FileText aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No papers yet</EmptyTitle>
          <EmptyDescription>
            Group the polls behind a manuscript into a paper, upload the manuscript for each
            review round, and share a review link that shows whether the paper reports the
            data as it was recorded.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/my-papers/new">Create your first paper</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <ul className="divide-y rounded-lg border bg-card">
      {papers.map((paper) => (
        <li key={paper.id} className="relative flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <Link
              href={`/my-papers/${paper.id}`}
              className="block break-words font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
            >
              {paper.title}
            </Link>
            <p className="text-sm text-muted-foreground">
              {paper.pollCount} {paper.pollCount === 1 ? 'study' : 'studies'} ·{' '}
              {paper.versionCount} {paper.versionCount === 1 ? 'review round' : 'review rounds'} ·
              created <time dateTime={paper.createdAt}>{formatDate(paper.createdAt)}</time>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {paper.hasPendingMatch ? (
              <Badge variant="outline" className="border-transparent bg-warning-soft text-warning">
                Needs your reply
              </Badge>
            ) : null}
            <PaperStatusBadge status={paper.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function PapersPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Your papers"
        actions={
          <Button asChild>
            <Link href="/my-papers/new">
              <Plus aria-hidden="true" />
              New paper
            </Link>
          </Button>
        }
      />
      <Suspense
        fallback={
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        }
      >
        <PaperList />
      </Suspense>
    </div>
  );
}
