'use client';

import { CircleCheck, CircleX, FileText } from 'lucide-react';
import { useId, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sha256OfFile } from '@/utils/hash';

/**
 * Lets a reviewer check that their copy of the manuscript is the file that
 * was checked. The file is fingerprinted in the browser and never uploaded.
 */
export function ManuscriptCheck({ sha256 }: { sha256: string }) {
  const id = useId();
  const [result, setResult] = useState<{ name: string; matches: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const hash = await sha256OfFile(file);
      setResult({ name: file.name, matches: hash === sha256 });
    } catch {
      setResult(null);
      setError('This file could not be read. Try again, or use a current browser.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <FileText className="size-4" aria-hidden="true" />
          Manuscript fingerprint (SHA-256)
        </p>
        <p className="break-all font-mono text-xs text-muted-foreground">{sha256}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id}>Compare with your copy</Label>
        <Input
          id={id}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(event) => onFile(event.currentTarget.files?.[0])}
          className="max-w-sm"
        />
        <p className="text-xs text-muted-foreground">
          The file stays on your device: only its fingerprint is computed, here in your
          browser.
        </p>
      </div>
      {/* Mounted from the start so screen readers announce the first result. */}
      <div role="status">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? (
        <p
          className={
            result.matches
              ? 'flex items-center gap-2 text-sm text-success'
              : 'flex items-center gap-2 text-sm text-destructive'
          }
        >
          {result.matches ? (
            <CircleCheck className="size-4" aria-hidden="true" />
          ) : (
            <CircleX className="size-4" aria-hidden="true" />
          )}
          {result.matches
            ? `${result.name} is the file that was checked.`
            : `${result.name} is a different file from the one that was checked.`}
        </p>
      ) : null}
      </div>
    </div>
  );
}
