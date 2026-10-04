'use client';

import { Check, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { formatCountdown, LAB_RESET_SECONDS, type ReceiptRecordStatus } from '@/utils/answers';
import { explorerTxUrl } from '@/utils/fingerprints';

function formatLocalTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

interface ReceiptProps {
  seq: number;
  createdAt: string;
  recordTx: string | null;
  recordStatus: ReceiptRecordStatus | null;
  /** True when the receipt is shown again because this device already answered. */
  alreadyAnswered: boolean;
  lab: boolean;
  onNextParticipant: () => void;
}

/**
 * The thank-you shown in place of the form. It is only ever rendered on the
 * client after a submit or after reading localStorage, so formatting the time
 * in the participant's own time zone cannot cause a hydration mismatch.
 */
export function Receipt({
  seq,
  createdAt,
  recordTx,
  recordStatus,
  alreadyAnswered,
  lab,
  onNextParticipant,
}: ReceiptProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // In lab mode the Next participant button takes the focus instead.
    if (!lab) headingRef.current?.focus();
  }, [lab]);

  return (
    <div
      role="status"
      className="flex flex-col items-start gap-4 sm:rounded-xl sm:border sm:bg-card sm:p-8"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
        <Check className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight outline-none"
        >
          Thank you.
        </h1>
        <p className="text-base">
          Your answer is <span className="whitespace-nowrap font-mono">#{seq}</span> in this poll, saved at{' '}
          <time dateTime={createdAt} className="whitespace-nowrap font-mono">
            {formatLocalTime(createdAt)}
          </time>
          .
        </p>
        <RecordLine tx={recordTx} status={recordStatus} />
        {alreadyAnswered ? (
          <p className="text-sm text-muted-foreground">You already answered on this device.</p>
        ) : null}
      </div>
      {lab ? <LabReset onNextParticipant={onNextParticipant} /> : null}
    </div>
  );
}

function RecordLine({ tx, status }: { tx: string | null; status: ReceiptRecordStatus | null }) {
  if (status === null || status === 'disabled') return null;
  if (status === 'failed' || !tx) {
    return (
      <p className="text-sm text-muted-foreground">
        Your answer is saved. Its record on Solana will be added shortly.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-base">
        {status === 'recorded' ? 'Recorded on Solana: ' : 'Being recorded on Solana: '}
        <a
          href={explorerTxUrl(tx)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"
        >
          view record
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(opens Solana Explorer in a new tab)</span>
        </a>
      </p>
      <p className="text-sm text-muted-foreground">
        Only a fingerprint was recorded, not your answer.
      </p>
    </div>
  );
}

function LabReset({ onNextParticipant }: { onNextParticipant: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(LAB_RESET_SECONDS);
  const onNextRef = useRef(onNextParticipant);

  useEffect(() => {
    onNextRef.current = onNextParticipant;
  }, [onNextParticipant]);

  useEffect(() => {
    const deadline = Date.now() + LAB_RESET_SECONDS * 1000;
    const timer = window.setInterval(() => {
      const left = (deadline - Date.now()) / 1000;
      if (left <= 0) {
        window.clearInterval(timer);
        onNextRef.current();
      } else {
        setSecondsLeft(left);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="w-full space-y-2">
      {/* Text only: nothing animates, so reduced-motion settings are respected. */}
      <Button
        type="button"
        size="lg"
        className="h-14 w-full text-lg"
        autoFocus
        onClick={onNextParticipant}
      >
        Next participant
      </Button>
      <p aria-live="off" className="text-center text-sm text-muted-foreground">
        <span className="tabular-nums">{formatCountdown(secondsLeft)}</span>
      </p>
    </div>
  );
}
