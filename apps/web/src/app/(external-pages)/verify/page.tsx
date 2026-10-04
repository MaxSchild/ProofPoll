import { ArrowRight, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { searchPapers } from '@/data/anon/paper-queries';
import { formatDate } from '@/utils/format';
import { PRODUCT_NAME } from '@/constants';

export const metadata: Metadata = {
  title: 'Verify a paper',
  description:
    'Find the polls behind a paper and see whether it reports the data as it was recorded.',
};

type SearchParams = Promise<{ q?: string | string[] }>;

function queryOf(q: string | string[] | undefined): string {
  return (Array.isArray(q) ? q[0] : q ?? '').trim();
}

async function SearchForm({ searchParams }: { searchParams: SearchParams }) {
  const query = queryOf((await searchParams).q);
  return (
    // A plain GET form: the search works without JavaScript and the URL can be shared.
    <form action="/verify" method="get" className="space-y-3" role="search">
      <Label htmlFor="q" className="text-base">
        What do you know about the paper?
      </Label>
      <Textarea
        id="q"
        name="q"
        defaultValue={query}
        rows={3}
        maxLength={2000}
        placeholder={`Paste a DOI, a title, authors, a full citation or a ${PRODUCT_NAME} link`}
      />
      <Button type="submit">
        <Search aria-hidden="true" />
        Find the paper
      </Button>
    </form>
  );
}

async function Results({ searchParams }: { searchParams: SearchParams }) {
  const query = queryOf((await searchParams).q);
  if (!query) return <Examples />;
  const { candidates } = await searchPapers(query);

  return (
    <section aria-labelledby="results-heading" className="space-y-4">
      <h2 id="results-heading" className="text-lg font-semibold tracking-tight">
        {candidates.length === 0
          ? 'No published paper found'
          : candidates.length === 1
            ? '1 paper found'
            : `${candidates.length} papers found`}
      </h2>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Only papers whose authors used {PRODUCT_NAME} and that have been published are listed.
          Try the DOI or the exact title.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {candidates.map((paper) => (
            <li key={paper.id} className="relative flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <Link
                  href={`/papers/${paper.id}`}
                  className="block break-words font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
                >
                  {paper.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {paper.authors.map((author) => author.name).join(', ') || 'No authors listed'}
                  {paper.publishedAt ? ` · ${formatDate(paper.publishedAt)}` : ''}
                </p>
                {paper.doi ? <p className="font-mono text-xs text-muted-foreground">{paper.doi}</p> : null}
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// The example studies seeded on the demo deployment (apps/web/scripts/seed-demo.mjs),
// one consistent and one inconsistent, as searches someone might paste.
const EXAMPLE_QUERIES = [
  { label: 'A title', query: 'Students will pay for reusable cups' },
  { label: 'A DOI', query: 'https://doi.org/10.5555/proofpoll.example.remote' },
];

function Examples() {
  return (
    <section aria-labelledby="examples-heading" className="space-y-3">
      <h2 id="examples-heading" className="text-sm font-medium text-muted-foreground">
        Try an example
      </h2>
      <ul className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((example) => (
          <li key={example.query}>
            <Link
              href={`/verify?q=${encodeURIComponent(example.query)}`}
              className="inline-flex max-w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <span className="text-muted-foreground">{example.label}:</span>
              <span className="truncate">{example.query}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-12 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Verify a paper</h1>
        <p className="max-w-2xl text-muted-foreground">
          Find the polls behind a published paper and see whether it reports the data as it
          was recorded: how many answers came in, which ones the registered rules exclude, and
          whether the paper&apos;s numbers match.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-36 w-full" />}>
        <SearchForm searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
