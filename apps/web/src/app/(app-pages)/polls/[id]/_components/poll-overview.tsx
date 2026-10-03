import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { PollDetails } from '@/data/user/poll-queries';
import { formatDateTime } from '@/utils/format';
import { DraftActions, OpenActions } from './poll-actions';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

const none = <span className="text-muted-foreground">None</span>;

export function PollOverview({ poll }: { poll: PollDetails }) {
  const { attentionCheck } = poll;

  return (
    <div className="space-y-6">
      {poll.status === 'closed' && poll.closedAt ? (
        <Alert>
          <AlertDescription>
            Closed on <time dateTime={poll.closedAt}>{formatDateTime(poll.closedAt)}</time>.{' '}
            {poll.answerCount} {poll.answerCount === 1 ? 'answer' : 'answers'} collected.
          </AlertDescription>
        </Alert>
      ) : null}

      <dl className="divide-y rounded-lg border bg-card px-4 sm:px-6">
        <Row label="Study plan">
          {poll.description ? (
            <p className="whitespace-pre-line">{poll.description}</p>
          ) : (
            none
          )}
        </Row>
        <Row label="Planned participants">
          {poll.plannedN ? (
            <span className="font-mono tabular-nums">{poll.plannedN}</span>
          ) : (
            none
          )}
        </Row>
        <Row label="Exclusion rules">
          {poll.exclusionRules.text || poll.exclusionRules.exclude_failed_attention_check ? (
            <div className="space-y-1">
              {poll.exclusionRules.text ? (
                <p className="whitespace-pre-line">{poll.exclusionRules.text}</p>
              ) : null}
              {poll.exclusionRules.exclude_failed_attention_check ? (
                <p className="text-sm text-muted-foreground">
                  Answers that fail the attention check are excluded.
                </p>
              ) : null}
            </div>
          ) : (
            none
          )}
        </Row>
        <Row label="Questions">
          <ol className="space-y-5">
            {poll.questions.map((question, index) => (
              <li key={question.id} className="flex gap-3">
                <span className="w-6 shrink-0 pt-px text-right font-mono text-sm tabular-nums text-muted-foreground">
                  {index + 1}.
                </span>
                <div className="min-w-0 space-y-2">
                  <p className="font-medium">{question.text}</p>
                  {attentionCheck?.question_id === question.id ? (
                    <Badge className="max-w-full border-transparent bg-warning-soft text-warning">
                      <span className="truncate">
                        Attention check, correct: {attentionCheck.correct_option}
                      </span>
                    </Badge>
                  ) : null}
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground marker:text-border">
                    {question.options.map((option) => (
                      <li key={option}>{option}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </Row>
        <Row label="Authors">
          {poll.authors.length > 0 ? (
            <ul className="space-y-0.5">
              {poll.authors.map((author, index) => (
                <li key={index}>
                  {author.name}
                  {author.affiliation ? (
                    <span className="text-muted-foreground">, {author.affiliation}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            none
          )}
        </Row>
        <Row label="Created">
          <time dateTime={poll.createdAt}>{formatDateTime(poll.createdAt)}</time>
        </Row>
        {poll.openedAt ? (
          <Row label="Opened">
            <time dateTime={poll.openedAt}>{formatDateTime(poll.openedAt)}</time>
          </Row>
        ) : null}
        {poll.closedAt ? (
          <Row label="Closed">
            <time dateTime={poll.closedAt}>{formatDateTime(poll.closedAt)}</time>
          </Row>
        ) : null}
      </dl>

      {poll.status === 'draft' ? <DraftActions id={poll.id} title={poll.title} /> : null}
      {poll.status === 'open' ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            The answer link and QR code are in the Share tab.
          </p>
          <OpenActions id={poll.id} />
        </div>
      ) : null}
    </div>
  );
}
