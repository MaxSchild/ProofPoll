'use client';

import { Download, Info } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useRef } from 'react';

import { CopyField } from '@/components/copy-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { PollStatus } from '@/utils/polls';
import { PRODUCT_SLUG } from '@/constants';

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
    link.download = `${PRODUCT_SLUG}-${pollId}-qr.png`;
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
