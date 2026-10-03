'use client';

import { ChevronDown, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { CopyField } from '@/components/copy-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { StudyVerdict } from '@/components/verification/study-verdict';
import { VerdictBadge } from '@/components/verification/verdict-badge';
import type { PaperPoll, PaperVersion } from '@/data/user/paper-queries';
import {
  confirmNumbersAction,
  discardVersionAction,
  startReviewRoundAction,
} from '@/data/user/papers';
import { formatDateTime } from '@/utils/format';
import { sha256OfFile } from '@/utils/hash';
import type { ConfirmNumbersValues } from '@/utils/zod-schemas/paper';

type ActionResult = { serverError?: string; validationErrors?: unknown } | undefined;

function errorOf(result: ActionResult, fallback: string): string | null {
  if (result?.serverError) return result.serverError;
  if (result?.validationErrors) return fallback;
  return null;
}

async function isPdf(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === '%PDF-';
}

interface ReviewRoundsProps {
  paperId: string;
  polls: PaperPoll[];
  versions: PaperVersion[];
  /** Why no round can be started, or null when one can. */
  blockedReason: string | null;
  reviewBaseUrl: string;
}

export function ReviewRounds({
  paperId,
  polls,
  versions,
  blockedReason,
  reviewBaseUrl,
}: ReviewRoundsProps) {
  const pending = versions.find((version) => version.confirmedAt === null) ?? null;
  const confirmed = versions.filter((version) => version.confirmedAt !== null);
  const nextNumber = (confirmed[0]?.version ?? 0) + 1;

  return (
    <div className="space-y-6">
      {blockedReason ? (
        <Alert>
          <AlertDescription>{blockedReason}</AlertDescription>
        </Alert>
      ) : (
        <ManuscriptUpload paperId={paperId} versionNumber={nextNumber} replacing={pending !== null} />
      )}

      {pending && !blockedReason ? (
        // Keyed by version: a new upload replaces the form's values.
        <ConfirmNumbers key={pending.id} version={pending} polls={polls} />
      ) : null}

      {confirmed.length > 0 ? (
        <ol className="space-y-4" aria-label="Confirmed review rounds">
          {confirmed.map((version, index) => (
            <ConfirmedVersion
              key={version.id}
              version={version}
              polls={polls}
              reviewUrl={`${reviewBaseUrl}/${version.reviewToken}`}
              defaultOpen={index === 0}
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function ManuscriptUpload({
  paperId,
  versionNumber,
  replacing,
}: {
  paperId: string;
  versionNumber: number;
  replacing: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      if (!(await isPdf(file))) {
        setError('This file is not a PDF. Upload the manuscript as a PDF.');
        return;
      }
      const sha256 = await sha256OfFile(file);
      const result = await startReviewRoundAction({ paperId, sha256, fileName: file.name });
      const message = errorOf(result, "The manuscript couldn't be read. Try again.");
      if (message) {
        setError(message);
        return;
      }
      toast.success('Numbers extracted. Check them below.');
      router.refresh();
    } catch {
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setBusy(false);
      input.value = '';
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed bg-card p-4 sm:p-6">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-base font-semibold">
          {replacing ? `Upload again for round ${versionNumber}` : `Start review round ${versionNumber}`}
        </Label>
        <p className="text-sm text-muted-foreground">
          Upload the manuscript you are submitting (PDF). The N, exclusions and key results it
          reports are extracted per study for you to confirm. The file itself is not kept: only
          its fingerprint (SHA-256), so reviewers can tell it&apos;s the same file.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          id={id}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(event) => onFile(event.currentTarget)}
          className="max-w-sm"
        />
        {busy ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner aria-hidden="true" />
            Reading the manuscript…
          </span>
        ) : (
          <Upload className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

type StudyFields = {
  reportedN: string;
  reportedExclusions: string;
  results: Record<string, Record<string, string>>;
};

function toFields(version: PaperVersion, polls: PaperPoll[]): Record<string, StudyFields> {
  return Object.fromEntries(
    version.studies.map((study) => {
      const poll = polls.find((p) => p.id === study.pollId);
      const results: StudyFields['results'] = {};
      for (const question of poll?.questions ?? []) {
        results[question.id] = Object.fromEntries(
          question.options.map((option) => {
            const value = study.reported.reported_results[question.id]?.[option];
            return [option, value === undefined ? '' : String(value)];
          })
        );
      }
      return [
        study.pollId,
        {
          reportedN: study.reported.reported_n?.toString() ?? '',
          reportedExclusions: study.reported.reported_exclusions?.toString() ?? '',
          results,
        },
      ];
    })
  );
}

function toNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return null;
  return Number(trimmed);
}

function ConfirmNumbers({ version, polls }: { version: PaperVersion; polls: PaperPoll[] }) {
  const router = useRouter();
  const [fields, setFields] = useState(() => toFields(version, polls));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setField(pollId: string, update: (current: StudyFields) => StudyFields) {
    setFields((all) => ({ ...all, [pollId]: update(all[pollId]) }));
  }

  async function confirm() {
    setError(null);
    const studies: ConfirmNumbersValues['studies'] = {};
    for (const [pollId, study] of Object.entries(fields)) {
      const reportedN = toNumber(study.reportedN);
      const reportedExclusions = toNumber(study.reportedExclusions);
      const results: Record<string, Record<string, number | null>> = {};
      for (const [questionId, options] of Object.entries(study.results)) {
        results[questionId] = Object.fromEntries(
          Object.entries(options).map(([option, value]) => [option, toNumber(value)])
        );
      }
      const numbers = [reportedN, reportedExclusions, ...Object.values(results).flatMap(Object.values)];
      if (numbers.some((value) => value !== null && Number.isNaN(value))) {
        setError('Enter numbers only, or leave a field empty if the paper doesn’t report it.');
        return;
      }
      studies[pollId] = { reportedN, reportedExclusions, reportedResults: results };
    }

    setBusy(true);
    try {
      const result = await confirmNumbersAction({ versionId: version.id, studies });
      const message = errorOf(
        result,
        'Check the numbers: N and exclusions are whole numbers, results are percentages from 0 to 100.'
      );
      if (message) {
        setError(message);
        return;
      }
      toast.success(`Round ${version.version} confirmed and checked`);
      router.refresh();
    } catch {
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="confirm-heading"
      className="space-y-6 rounded-lg border-2 border-primary/30 bg-card p-4 sm:p-6"
    >
      <div className="space-y-1">
        <h3 id="confirm-heading" className="text-lg font-semibold tracking-tight">
          Confirm the numbers for round {version.version}
        </h3>
        <p className="text-sm text-muted-foreground">
          Extracted from <span className="font-medium text-foreground">{version.manuscriptName}</span>.
          Correct anything that doesn&apos;t match the manuscript, and leave a field empty if the
          paper doesn&apos;t report it. Once confirmed, each study is checked against the record
          and the round can&apos;t be changed.
        </p>
      </div>

      {version.studies.map((study, index) => {
        const poll = polls.find((p) => p.id === study.pollId);
        const value = fields[study.pollId];
        if (!poll || !value) return null;
        return (
          <fieldset key={study.pollId} className="space-y-4 border-t pt-4 first-of-type:border-t-0 first-of-type:pt-0">
            <legend className="font-medium">
              <span className="text-muted-foreground">Study {index + 1}:</span> {poll.title}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`n-${study.pollId}`}>Reported N</Label>
                <Input
                  id={`n-${study.pollId}`}
                  aria-describedby={`n-${study.pollId}-hint`}
                  inputMode="numeric"
                  value={value.reportedN}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    setField(study.pollId, (current) => ({ ...current, reportedN: next }));
                  }}
                  className="font-mono"
                />
                <p id={`n-${study.pollId}-hint`} className="text-xs text-muted-foreground">
                  Participants in the analysis.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`ex-${study.pollId}`}>Reported exclusions</Label>
                <Input
                  id={`ex-${study.pollId}`}
                  aria-describedby={`ex-${study.pollId}-hint`}
                  inputMode="numeric"
                  value={value.reportedExclusions}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    setField(study.pollId, (current) => ({ ...current, reportedExclusions: next }));
                  }}
                  className="font-mono"
                />
                <p id={`ex-${study.pollId}-hint`} className="text-xs text-muted-foreground">
                  Answers the paper says it excluded.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Reported results (% per option)</p>
              {poll.questions.map((question, qIndex) => (
                <div key={question.id} className="space-y-2">
                  <p className="text-sm">
                    <span className="font-mono text-muted-foreground">Q{qIndex + 1}</span>{' '}
                    {question.text}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {question.options.map((option, oIndex) => {
                      const inputId = `r-${study.pollId}-${question.id}-${oIndex}`;
                      return (
                        <div key={option} className="flex items-center gap-2">
                          <Label htmlFor={inputId} className="min-w-0 flex-1 break-words font-normal">
                            {option}
                          </Label>
                          <Input
                            id={inputId}
                            inputMode="decimal"
                            aria-label={`Study ${index + 1}, question ${qIndex + 1}, ${option}: reported percent`}
                            value={value.results[question.id]?.[option] ?? ''}
                            onChange={(event) => {
                              const next = event.currentTarget.value;
                              setField(study.pollId, (current) => ({
                                ...current,
                                results: {
                                  ...current.results,
                                  [question.id]: { ...current.results[question.id], [option]: next },
                                },
                              }));
                            }}
                            className="w-20 text-right font-mono"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        );
      })}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={confirm} disabled={busy}>
          {busy ? <Spinner aria-hidden="true" /> : null}
          Confirm and check
        </Button>
        <ConfirmActionDialog
          trigger={
            <Button type="button" variant="outline" disabled={busy}>
              Discard upload
            </Button>
          }
          title="Discard this upload?"
          description="The extracted numbers are removed. You can upload the manuscript again."
          confirmLabel="Discard"
          destructive
          onConfirm={async () => {
            const message = errorOf(
              await discardVersionAction({ versionId: version.id }),
              'This upload could not be found.'
            );
            if (!message) router.refresh();
            return message;
          }}
        />
      </div>
    </section>
  );
}

function ConfirmedVersion({
  version,
  polls,
  reviewUrl,
  defaultOpen,
}: {
  version: PaperVersion;
  polls: PaperPoll[];
  reviewUrl: string;
  defaultOpen: boolean;
}) {
  return (
    <li className="rounded-lg border bg-card">
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 p-4 sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="font-semibold">Round {version.version}</span>
          <span className="text-sm text-muted-foreground">
            {version.confirmedAt ? (
              <time dateTime={version.confirmedAt}>{formatDateTime(version.confirmedAt)}</time>
            ) : null}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {version.studies.map((study) =>
              study.validation ? (
                <VerdictBadge key={study.pollId} verdict={study.validation.verdict} />
              ) : null
            )}
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </span>
        </summary>
        <div className="space-y-6 border-t p-4 sm:p-6">
          <CopyField
            id={`review-${version.id}`}
            label={`Review link, round ${version.version}`}
            value={reviewUrl}
            hint="Unlisted: only people with the link can open it. Authors are shown as “Author 1, 2…”, and no individual answers are shown."
          />
          <p className="text-sm text-muted-foreground">
            Manuscript: {version.manuscriptName} ·{' '}
            <span className="font-mono" title={version.manuscriptSha256}>
              SHA-256 {version.manuscriptSha256.slice(0, 12)}…
            </span>
          </p>
          {version.studies.map((study, index) => {
            const poll = polls.find((p) => p.id === study.pollId);
            return (
              <div key={study.pollId} className="space-y-3">
                <h4 className="font-medium">
                  <span className="text-muted-foreground">Study {index + 1}:</span>{' '}
                  {poll?.title ?? study.pollId}
                </h4>
                {study.validation ? (
                  <StudyVerdict validation={study.validation} questions={poll?.questions ?? []} />
                ) : null}
              </div>
            );
          })}
        </div>
      </details>
    </li>
  );
}
