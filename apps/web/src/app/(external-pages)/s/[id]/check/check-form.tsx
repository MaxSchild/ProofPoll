'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { checkDatasetAction, type DatasetCheckResult, type RowResult } from '@/data/anon/records';

const ROW_LABELS: Record<RowResult, string> = {
  ok: 'Matches',
  changed: 'Changed since recorded',
  not_recorded: 'Never recorded',
  unverifiable: 'Salt deleted (cannot be checked)',
};

export function CheckForm({ pollId, questionIds }: { pollId: string; questionIds: string[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DatasetCheckResult | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    // Read from the input itself, so a file chosen before hydration counts.
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await checkDatasetAction({ pollId, csv: await file.text() });
      if (response?.data) setResult(response.data);
      else if (response?.validationErrors) setError('That file is empty or larger than 2 MB.');
      else setError(response?.serverError ?? 'The check could not run. Try again.');
    } catch {
      setError('The check could not run. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4 sm:p-6">
        <Label htmlFor="dataset">Dataset (CSV)</Label>
        <Input
          id="dataset"
          type="file"
          accept=".csv,text/csv"
          ref={inputRef}
        />
        <p className="text-sm text-muted-foreground">
          Needs the columns <code className="font-mono">response_id</code>,{' '}
          {questionIds.map((id) => (
            <code key={id} className="mr-1 font-mono">
              {id}
            </code>
          ))}
          as in the CSV AllCounted exports. Other columns are ignored.
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {busy ? 'Reading the record from Solana…' : 'Check dataset'}
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {result ? <CheckResult result={result} /> : null}
    </div>
  );
}

function CheckResult({ result }: { result: DatasetCheckResult }) {
  const problems = result.rows.filter((row) => row.result !== 'ok');
  const missing = result.missing.filter((entry) => !entry.excludedByRule);
  const excluded = result.missing.filter((entry) => entry.excludedByRule);

  return (
    <section className="space-y-4" aria-live="polite">
      <div
        className={`flex items-start gap-3 rounded-lg border p-4 sm:p-6 ${
          result.passed ? 'bg-success-soft' : 'bg-destructive/10'
        }`}
      >
        {result.passed ? (
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <XCircle className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden="true" />
        )}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {result.passed ? 'The dataset matches the record' : 'The dataset does not match the record'}
          </h2>
          <p className="text-sm">
            {result.recordedOnChain} answers on Solana · {result.rows.length} rows in the file
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Matching rows" value={result.counts.ok} />
        <Stat label="Changed" value={result.counts.changed} bad />
        <Stat label="Never recorded" value={result.counts.not_recorded} bad />
        <Stat label="Missing from file" value={result.counts.missing} bad />
        <Stat label="Excluded by registered rule" value={result.counts.excluded_by_rule} />
        <Stat label="Plan on Solana" value={result.planMatches ? 'Matches' : result.planOnChain ? 'Differs' : 'Not found'} bad={!result.planMatches} />
      </dl>

      {problems.length > 0 || missing.length > 0 || excluded.length > 0 ? (
        <ul className="divide-y rounded-lg border bg-card text-sm">
          {problems.map((row) => (
            <li key={row.responseId} className="flex justify-between gap-4 px-4 py-2">
              <span className="font-mono">
                {row.seq ? `#${row.seq} ` : ''}
                {row.responseId}
              </span>
              <span>{ROW_LABELS[row.result]}</span>
            </li>
          ))}
          {missing.map((entry) => (
            <li key={`m${entry.seq}`} className="flex justify-between gap-4 px-4 py-2">
              <span className="font-mono">#{entry.seq}</span>
              <span>Recorded, but missing from the file</span>
            </li>
          ))}
          {excluded.map((entry) => (
            <li key={`x${entry.seq}`} className="flex justify-between gap-4 px-4 py-2 text-muted-foreground">
              <span className="font-mono">#{entry.seq}</span>
              <span>Left out by the registered attention-check rule</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Stat({ label, value, bad = false }: { label: string; value: number | string; bad?: boolean }) {
  const flagged = bad && value !== 0;
  return (
    <div className="rounded-lg border bg-card p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-mono text-xl tabular-nums ${flagged ? 'text-destructive' : ''}`}>{value}</dd>
    </div>
  );
}
