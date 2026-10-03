import { Check, Minus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { PollQuestion } from '@/utils/polls';
import {
  describeCountCheck,
  describeCountGap,
  describeExclusionNote,
  LEVEL_LABELS,
  type StudyValidation,
} from '@/utils/verification';
import { VerdictBadge } from './verdict-badge';

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function LevelHeading({ level, ran }: { level: string; ran: boolean }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium">
      {ran ? (
        <Check className="size-4 text-success" aria-hidden="true" />
      ) : (
        <Minus className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
      {LEVEL_LABELS[level]}
      <span className="font-normal text-muted-foreground">{ran ? 'ran' : 'not run'}</span>
    </p>
  );
}

/**
 * The verdict for one study and every check behind it, with the numbers the
 * paper reports next to the record, so a reviewer can compare them with
 * their copy.
 */
export function StudyVerdict({
  validation,
  questions,
}: {
  validation: StudyValidation;
  questions: PollQuestion[];
}) {
  const { count, results } = validation.details;
  const gap = describeCountGap(count);
  const exclusionNote = describeExclusionNote(count);
  const questionNumber = new Map(questions.map((q, index) => [q.id, index + 1]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge verdict={validation.verdict} />
        <span className="text-sm text-muted-foreground">
          {validation.levels_run.length === 0
            ? 'No check could run: the paper reports no N and no results for this study.'
            : `Checks run: ${validation.levels_run.map((level) => LEVEL_LABELS[level]).join(', ')}`}
        </span>
      </div>

      <div className="space-y-1.5">
        <LevelHeading level="count" ran={count.ran} />
        <p className="pl-6 font-mono text-sm tabular-nums">{describeCountCheck(count)}</p>
        {gap ? <p className="pl-6 text-sm text-destructive">{gap}</p> : null}
        {exclusionNote ? (
          <p className="pl-6 text-sm text-muted-foreground">{exclusionNote}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <LevelHeading level="results" ran={results.ran} />
        {results.ran && results.items ? (
          <ul className="space-y-1 pl-6">
            {results.items.map((item) => (
              <li
                key={`${item.question_id}-${item.option}`}
                className={cn(
                  'flex flex-wrap items-center gap-x-2 text-sm',
                  !item.ok && 'text-destructive'
                )}
              >
                {item.ok ? (
                  <Check className="size-3.5 text-success" aria-hidden="true" />
                ) : (
                  <X className="size-3.5" aria-hidden="true" />
                )}
                <span className="sr-only">{item.ok ? 'Matches:' : 'Differs:'}</span>
                <span className="font-mono text-muted-foreground">
                  Q{questionNumber.get(item.question_id) ?? '?'}
                </span>
                <span className="min-w-0 break-words">{item.option}:</span>
                <span className="font-mono tabular-nums">
                  paper {formatPercent(item.reported)} / record {formatPercent(item.recorded)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pl-6 text-sm text-muted-foreground">
            The paper reports no results for this study.
          </p>
        )}
        {results.ran ? (
          <p className="pl-6 text-xs text-muted-foreground">
            Percentages of the {results.base} answers left after the registered exclusions.
            Differences up to 0.5 points count as rounding.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <LevelHeading level="dataset" ran={false} />
        <p className="pl-6 text-sm text-muted-foreground">
          Needs the published dataset, compared row by row with the record.
        </p>
      </div>
    </div>
  );
}
