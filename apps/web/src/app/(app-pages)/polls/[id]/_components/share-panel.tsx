'use client';

import { Check, Copy, Download, Info } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import type { PollStatus } from '@/utils/polls';

interface SharePanelProps {
  pollId: string;
  status: PollStatus;
  answerUrl: string;
  labUrl: string;
}

export function SharePanel({ pollId, status, answerUrl, labUrl }: SharePanelProps) {
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  if (status === 'draft') {
    return (
      <Alert>
        <Info aria-hidden="true" />
        <AlertDescription>
          This poll is a draft. Open it to get a link and QR code.
        </AlertDescription>
      </Alert>
    );
  }

  function downloadQr() {
    const canvas = qrWrapperRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `allcounted-${pollId}-qr.png`;
    link.click();
  }

  return (
    <div className="space-y-6">
      {status === 'closed' ? (
        <Alert>
          <Info aria-hidden="true" />
          <AlertDescription>
            This poll is closed. The link still works, but participants see that it no
            longer accepts answers.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-8 md:grid-cols-[auto_1fr]">
        <div className="space-y-3">
          {/* Always black on white, also in dark mode, so phones can scan it. */}
          <div
            ref={qrWrapperRef}
            className="w-fit rounded-lg border bg-white p-4"
            role="img"
            aria-label="QR code for the answer link"
          >
            <QRCodeCanvas value={answerUrl} size={240} level="M" marginSize={0} />
          </div>
          <Button type="button" variant="outline" onClick={downloadQr}>
            <Download aria-hidden="true" />
            Download PNG
          </Button>
        </div>
        <div className="min-w-0 space-y-6">
          <CopyField
            id="answer-link"
            label="Answer link"
            value={answerUrl}
            hint="Share this link or the QR code. Participants answer without signing in."
          />
          <CopyField
            id="lab-link"
            label="Lab mode link"
            value={labUrl}
            hint="For one shared computer. The form resets after each participant."
          />
        </div>
      </div>
    </div>
  );
}

function CopyField({
  id,
  label,
  value,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  hint: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Link copied');
    } catch {
      toast.error("The link couldn't be copied. Select it and copy it by hand.");
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <InputGroup>
        <InputGroupInput
          id={id}
          readOnly
          value={value}
          className="font-mono text-sm"
          onFocus={(event) => event.currentTarget.select()}
          aria-describedby={`${id}-hint`}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="sm" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
