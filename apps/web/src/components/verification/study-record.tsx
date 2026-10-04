import Link from 'next/link';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/utils/format';
import type { StudySummary } from '@/utils/verification';
import { StudyVerdict } from './study-verdict';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Time({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-muted-foreground">Not recorded</span>;
  return <time dateTime={iso}>{formatDateTime(iso)}</time>;
}

/**
 * One study as reviewers and the public see it: the plan as registered, the
 * count, the verdict, and (only if the researcher opted in) the results.
 */
export function StudyRecord({ study, index }: { study: StudySummary; index: number }) {
  const rules = study.exclusion_rules;
  const check = study.attention_check;

  return (
    <article
      aria-labelledby={`study-${study.poll_id}`}
      className="space-y-6 rounded-lg border bg-card p-4 sm:p-6"
    >
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Study {index + 1}</p>
        <h2 id={`study-${study.poll_id}`} className="text-xl font-semibold tracking-tight">
          {study.title}
        </h2>
      </header>

      <section aria-label="Verdict" className="rounded-md bg-muted/40 p-4">
        {study.validation ? (
          <StudyVerdict
            validation={study.validation}
            questions={study.questions}
            checkHref={`/s/${study.poll_id}/check`}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No verdict for this study.</p>
        )}
      </section>

      <dl className="divide-y">
        <Row label="Answers recorded">
          <span className="font-mono tabular-nums">{study.recorded}</span>
          {study.planned_n ? (
            <span className="text-muted-foreground"> of {study.planned_n} planned</span>
          ) : null}
        </Row>
        <Row label="Record on Solana">
          <Link
            href={`/s/${study.poll_id}`}
            className="font-medium text-primary underline underline-offset-4"
          >
            Plan and every answer&apos;s fingerprint
          </Link>
          <p className="text-sm text-muted-foreground">
            Written to Solana devnet as each answer arrived, so none can be added or removed later.
          </p>
        </Row>
        <Row label="Registered">
          <Time iso={study.opened_at} />
          <p className="text-sm text-muted-foreground">
            The plan, questions and rules below were fixed at this time.
          </p>
        </Row>
        <Row label="Collected">
          {study.first_answer_at ? (
            <>
              <Time iso={study.first_answer_at} /> to <Time iso={study.last_answer_at} />
            </>
          ) : (
            <span className="text-muted-foreground">No answers</span>
          )}
        </Row>
        <Row label="Study plan">
          {study.description ? (
            <p className="whitespace-pre-line">{study.description}</p>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </Row>
        <Row label="Exclusion rules">
          {rules.text || rules.exclude_failed_attention_check ? (
            <div className="space-y-1">
              {rules.text ? <p className="whitespace-pre-line">{rules.text}</p> : null}
              {rules.exclude_failed_attention_check ? (
                <p className="text-sm text-muted-foreground">
                  Answers that fail the attention check are excluded.
                </p>
              ) : null}
            </div>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </Row>
        <Row label="Questions">
          <ol className="space-y-4">
            {study.questions.map((question, qIndex) => {
              const counts = study.results?.[question.id];
              const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
              return (
                <li key={question.id} className="flex gap-3">
                  <span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {qIndex + 1}.
                  </span>
                  <div className="min-w-0 space-y-1.5">
                    <p className="font-medium">{question.text}</p>
                    {check?.question_id === question.id ? (
                      <Badge className="max-w-full border-transparent bg-warning-soft text-warning">
                        <span className="truncate">
                          Attention check, correct: {check.correct_option}
                        </span>
                      </Badge>
                    ) : null}
                    <ul className="space-y-0.5 text-sm text-muted-foreground">
                      {question.options.map((option) => (
                        <li key={option} className="flex justify-between gap-4">
                          <span className="min-w-0 break-words">{option}</span>
                          {counts ? (
                            <span className="shrink-0 font-mono tabular-nums">
                              {counts[option] ?? 0} ·{' '}
                              {total > 0 ? Math.round(((counts[option] ?? 0) / total) * 100) : 0}%
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
          {study.results ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Counts over all recorded answers, before exclusions. Shown because the authors
              chose to publish them.
            </p>
          ) : null}
        </Row>
      </dl>
    </article>
  );
}
