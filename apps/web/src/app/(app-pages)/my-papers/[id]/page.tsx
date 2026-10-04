import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { PollStatusBadge } from '@/components/poll-status-badge';
import { PaperStatusBadge } from '@/components/verification/paper-status-badge';
import { getPaper, type PaperDetails } from '@/data/user/paper-queries';
import { toSiteURL } from '@/utils/helpers';
import { DraftPaperActions } from './_components/paper-actions';
import { PublicationPanel } from './_components/publication-panel';
import { ReviewRounds } from './_components/review-rounds';

export const metadata: Metadata = { title: 'Paper' };

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="space-y-1">
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function blockedReason(paper: PaperDetails): string | null {
  if (paper.status === 'published') return 'This paper is published. It gets no new review rounds.';
  if (paper.polls.length === 0) return 'Add a poll to this paper first.';
  const open = paper.polls.filter((poll) => poll.status !== 'closed');
  if (open.length > 0) {
    return `Close all polls before sending the paper to review. Still open: ${open.map((poll) => poll.title).join(', ')}.`;
  }
  return null;
}

export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = await getPaper(id);
  if (!paper) notFound();
  const pendingMatch = paper.matches.find((match) => match.status === 'pending') ?? null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6">
      <div className="space-y-4">
        <Link
          href="/my-papers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Papers
        </Link>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
                {paper.title}
              </h1>
              <PaperStatusBadge status={paper.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {paper.authors.length > 0
                ? paper.authors
                    .map((a) => (a.affiliation ? `${a.name} (${a.affiliation})` : a.name))
                    .join(', ')
                : 'No authors listed'}
            </p>
          </div>
          {paper.status === 'draft' ? <DraftPaperActions id={paper.id} /> : null}
        </header>
      </div>

      <Section id="studies-heading" title="Studies" description="The polls this paper reports on.">
        <ul className="divide-y rounded-lg border bg-card">
          {paper.polls.map((poll, index) => (
            <li key={poll.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <span className="font-mono text-sm text-muted-foreground">{index + 1}.</span>
              <Link
                href={`/polls/${poll.id}`}
                className="min-w-0 break-words font-medium underline-offset-4 hover:underline"
              >
                {poll.title}
              </Link>
              <PollStatusBadge status={poll.status} />
              <span className="ml-auto font-mono text-sm tabular-nums text-muted-foreground">
                {poll.answerCount}
                {poll.plannedN ? ` / ${poll.plannedN}` : ''}{' '}
                {poll.answerCount === 1 ? 'answer' : 'answers'}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="review-heading"
        title="Review rounds"
        description="One round per submission. Each gets its own review link; earlier links keep working."
      >
        <ReviewRounds
          paperId={paper.id}
          polls={paper.polls}
          versions={paper.versions}
          blockedReason={blockedReason(paper)}
          reviewBaseUrl={toSiteURL('/review').replace(/\/$/, '')}
        />
      </Section>

      <Section id="publication-heading" title="Publication">
        <PublicationPanel
          paperId={paper.id}
          status={paper.status}
          doi={paper.doi}
          publishedAt={paper.publishedAt}
          autoMatched={paper.autoMatched}
          resultsPublic={paper.resultsPublic}
          pendingMatch={pendingMatch}
          publicUrl={toSiteURL(`/papers/${paper.id}`)}
        />
      </Section>
    </div>
  );
}
