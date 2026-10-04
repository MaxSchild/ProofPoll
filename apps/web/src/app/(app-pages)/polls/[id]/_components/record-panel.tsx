import { Info } from 'lucide-react';
import Link from 'next/link';

import { AnswerRecordsTable, PlanRecord } from '@/components/record/record-view';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { AnswerRecord, PollRecord } from '@/data/anon/record-queries';
import type { PollStatus } from '@/utils/polls';
import { RetryRecordsButton } from './retry-records-button';

export function RecordPanel({
  pollId,
  status,
  record,
  answers,
}: {
  pollId: string;
  status: PollStatus;
  record: PollRecord | null;
  answers: AnswerRecord[];
}) {
  if (status === 'draft' || !record) {
    return (
      <Alert>
        <Info aria-hidden="true" />
        <AlertDescription>
          This poll is a draft. Opening it registers the plan on Solana, and every answer is then
          recorded as it arrives.
        </AlertDescription>
      </Alert>
    );
  }

  const unrecorded =
    (record.planStatus === 'recorded' ? 0 : 1) +
    answers.filter((answer) => answer.status !== 'recorded').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/s/${pollId}`}>Public record page</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/s/${pollId}/check`}>Check a dataset</Link>
        </Button>
        {unrecorded > 0 ? <RetryRecordsButton pollId={pollId} count={unrecorded} /> : null}
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Plan</h2>
        <PlanRecord record={record} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Answers</h2>
        <p className="text-sm text-muted-foreground">
          Each answer&apos;s fingerprint (a salted SHA-256 of its answers) is recorded on Solana
          devnet when it arrives. The answers themselves never leave AllCounted.
        </p>
        <AnswerRecordsTable records={answers} />
      </section>
    </div>
  );
}
