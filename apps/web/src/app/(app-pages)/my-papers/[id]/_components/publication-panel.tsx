'use client';

import { BellRing, ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { CopyField } from '@/components/copy-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import type { DoiMatch } from '@/data/user/paper-queries';
import {
  expireMatchAction,
  publishPaperAction,
  respondToMatchAction,
  runDetectionAction,
  setResultsPublicAction,
} from '@/data/user/papers';
import { formatDate, formatDateTime } from '@/utils/format';
import type { PaperStatus } from '@/utils/verification';

type ActionResult = { serverError?: string; validationErrors?: unknown } | undefined;

function errorOf(result: ActionResult, fallback: string): string | null {
  if (result?.serverError) return result.serverError;
  if (result?.validationErrors) return fallback;
  return null;
}

interface PublicationPanelProps {
  paperId: string;
  status: PaperStatus;
  doi: string | null;
  publishedAt: string | null;
  autoMatched: boolean;
  resultsPublic: boolean;
  pendingMatch: DoiMatch | null;
  publicUrl: string;
}

export function PublicationPanel(props: PublicationPanelProps) {
  const { status } = props;

  return (
    <div className="space-y-6">
      {status === 'draft' ? (
        <p className="text-sm text-muted-foreground">
          A paper can be published once it has a confirmed review round.
        </p>
      ) : null}
      {status === 'in_review' ? (
        <>
          {props.pendingMatch ? (
            <PendingMatch match={props.pendingMatch} />
          ) : (
            <Detection paperId={props.paperId} />
          )}
          <AttachDoi paperId={props.paperId} />
        </>
      ) : null}
      {status === 'published' && props.doi ? (
        <Published
          doi={props.doi}
          publishedAt={props.publishedAt}
          autoMatched={props.autoMatched}
          publicUrl={props.publicUrl}
        />
      ) : null}
      <ResultsOptIn paperId={props.paperId} resultsPublic={props.resultsPublic} />
    </div>
  );
}

function AttachDoi({ paperId }: { paperId: string }) {
  const id = useId();
  const router = useRouter();
  const [doi, setDoi] = useState('');
  const cleanDoi = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');

  async function publish(): Promise<string | null> {
    const message = errorOf(
      await publishPaperAction({ paperId, doi: cleanDoi }),
      'Enter a DOI like 10.1287/mnsc.2026.01234'
    );
    if (!message) {
      toast.success('Paper published');
      router.refresh();
    }
    return message;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Attach the DOI and publish</Label>
      <p className="text-sm text-muted-foreground">
        Once the paper is out, its page becomes public and searchable, with your names, the
        plans, rules, counts and the verdict per study. This can&apos;t be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          id={id}
          value={doi}
          onChange={(event) => setDoi(event.currentTarget.value)}
          placeholder="10.1287/mnsc.2026.01234"
          autoComplete="off"
          className="max-w-sm font-mono"
        />
        <ConfirmActionDialog
          trigger={<Button disabled={cleanDoi === ''}>Publish</Button>}
          title={`Publish with DOI ${cleanDoi}?`}
          description="The page becomes public and searchable, with your names. The DOI can't be changed and the paper can't be unpublished."
          cancelLabel="Not yet"
          confirmLabel="Publish"
          onConfirm={publish}
        />
      </div>
    </div>
  );
}

function Detection({ paperId }: { paperId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const result = await runDetectionAction({ id: paperId });
      const message = errorOf(result, 'This paper could not be found.');
      if (message) toast.error(message);
      else if (result?.data?.found) router.refresh();
      else toast.info('No published version found yet.');
    } catch {
      toast.error('Something went wrong. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-medium">
          <Search className="size-4" aria-hidden="true" />
          Forgot the DOI? We look for it.
        </p>
        <p className="text-sm text-muted-foreground">
          Every day we search Crossref and OpenAlex for published papers that cite your
          AllCounted links or match this title and authors. If we find one, we ask you to
          confirm. Without a reply within 14 days, the page goes public anyway, marked
          “matched automatically”.
        </p>
      </div>
      <Button type="button" variant="outline" onClick={run} disabled={busy}>
        {busy ? <Spinner aria-hidden="true" /> : null}
        Run detection now
      </Button>
    </div>
  );
}

function PendingMatch({ match }: { match: DoiMatch }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(kind: 'confirm' | 'reject' | 'expire') {
    setBusy(kind);
    try {
      const result =
        kind === 'expire'
          ? await expireMatchAction({ matchId: match.id })
          : await respondToMatchAction({ matchId: match.id, confirm: kind === 'confirm' });
      const message = errorOf(result, 'This match could not be found.');
      if (message) {
        toast.error(message);
        return;
      }
      if (kind === 'confirm') toast.success('Paper published');
      if (kind === 'expire') toast.success('Published automatically');
      router.refresh();
    } catch {
      toast.error('Something went wrong. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Alert className="border-warning/40 bg-warning-soft">
      <BellRing aria-hidden="true" />
      <AlertTitle>Is this your paper?</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {match.source === 'crossref' ? 'Crossref' : 'OpenAlex'} lists{' '}
          <span className="font-medium text-foreground">“{match.matchedTitle}”</span> with DOI{' '}
          <span className="font-mono text-foreground">{match.doi}</span>
          {match.reason === 'cites_link'
            ? ', which cites an AllCounted link of this paper.'
            : ', matching this paper’s title and authors.'}
        </p>
        <p>
          Without a reply by{' '}
          <time dateTime={match.confirmBy} className="font-medium text-foreground">
            {formatDate(match.confirmBy)}
          </time>
          , the page goes public with this DOI, marked “matched automatically”.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => act('confirm')} disabled={busy !== null}>
            {busy === 'confirm' ? <Spinner aria-hidden="true" /> : null}
            Yes, publish with this DOI
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => act('reject')}
            disabled={busy !== null}
          >
            Not my paper
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => act('expire')}
            disabled={busy !== null}
          >
            {busy === 'expire' ? <Spinner aria-hidden="true" /> : null}
            Skip the 14-day wait
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function Published({
  doi,
  publishedAt,
  autoMatched,
  publicUrl,
}: {
  doi: string;
  publishedAt: string | null;
  autoMatched: boolean;
  publicUrl: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        Published as{' '}
        <a
          href={`https://doi.org/${doi}`}
          className="font-mono underline underline-offset-4"
          target="_blank"
          rel="noreferrer"
        >
          {doi}
        </a>
        {publishedAt ? (
          <span className="text-sm text-muted-foreground">
            on <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>
          </span>
        ) : null}
        {autoMatched ? (
          <Badge variant="outline" className="text-muted-foreground">
            Matched automatically
          </Badge>
        ) : null}
      </div>
      <CopyField
        id="public-link"
        label="Public page"
        value={publicUrl}
        hint="Anyone can open and find this page. Cite it in the paper so readers land here directly."
      />
      <Button asChild variant="outline">
        <Link href={publicUrl.replace(/^https?:\/\/[^/]+/, '')}>
          <ExternalLink aria-hidden="true" />
          Open public page
        </Link>
      </Button>
    </div>
  );
}

function ResultsOptIn({ paperId, resultsPublic }: { paperId: string; resultsPublic: boolean }) {
  const id = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      const message = errorOf(
        await setResultsPublicAction({ paperId, resultsPublic: next }),
        'This paper could not be found.'
      );
      if (message) toast.error(message);
      else router.refresh();
    } catch {
      toast.error('Something went wrong. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3 border-t pt-4">
      <Switch id={id} checked={resultsPublic} disabled={busy} onCheckedChange={toggle} />
      <div className="space-y-1">
        <Label htmlFor={id}>Show results publicly</Label>
        <p className="text-sm text-muted-foreground">
          Adds the option counts per question to the public page once the paper is published.
          Individual answers are never shown.
        </p>
      </div>
    </div>
  );
}
