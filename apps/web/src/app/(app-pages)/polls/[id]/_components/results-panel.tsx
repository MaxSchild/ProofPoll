import { Download } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PollAttentionCheck, PollQuestion } from '@/utils/polls';
import { failsAttentionCheck, tallyAnswers, type PollResponseRow } from '@/utils/results';

const MAX_ROWS = 200;

// Times in UTC, so the server render and the browser agree.
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
});

interface ResultsPanelProps {
  pollId: string;
  questions: PollQuestion[];
  attentionCheck: PollAttentionCheck | null;
  plannedN: number | null;
  responses: PollResponseRow[];
}

export function ResultsPanel({
  pollId,
  questions,
  attentionCheck,
  plannedN,
  responses,
}: ResultsPanelProps) {
  const tallies = tallyAnswers(questions, responses);
  const failed = responses.filter((response) => failsAttentionCheck(response, attentionCheck));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-mono text-base tabular-nums text-foreground">
            {responses.length}
          </span>{' '}
          {responses.length === 1 ? 'answer' : 'answers'} recorded
          {plannedN ? (
            <>
              {' '}
              (planned <span className="font-mono tabular-nums">{plannedN}</span>)
            </>
          ) : null}
          {attentionCheck ? (
            <>
              {' · '}
              <span className="font-mono tabular-nums">{failed.length}</span> failed the
              attention check
            </>
          ) : null}
        </p>
        {/* A plain link: the route streams the file with a download header. */}
        <Button asChild variant="outline" className="w-fit">
          <a href={`/polls/${pollId}/export.csv`} download>
            <Download aria-hidden="true" />
            Download CSV
          </a>
        </Button>
      </div>

      {responses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No answers yet. Share the link to start collecting.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {tallies.map(({ question, options, total }, index) => {
          const isCheck = attentionCheck?.question_id === question.id;
          return (
            <Card key={question.id} className="shadow-none">
              <CardHeader className="space-y-2">
                <CardTitle className="flex gap-2 text-base font-medium leading-snug">
                  <span className="font-mono text-muted-foreground">Q{index + 1}</span>
                  <span className="break-words">{question.text}</span>
                </CardTitle>
                {isCheck ? (
                  <Badge variant="outline" className="w-fit bg-warning-soft text-warning">
                    Attention check
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {options.map(({ option, count }) => {
                    const share = total > 0 ? Math.round((count / total) * 100) : 0;
                    const correct = isCheck && attentionCheck?.correct_option === option;
                    return (
                      <li key={option} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 break-words">
                            {option}
                            {correct ? (
                              <span className="ml-2 text-xs text-success">correct answer</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                            {count} · {share}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <div
                            className={correct ? 'h-full bg-chart-3' : 'h-full bg-chart-1'}
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {responses.length > 0 ? (
        <section className="space-y-3" aria-labelledby="answers-heading">
          <h2 id="answers-heading" className="text-base font-semibold">
            Answers
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">#</TableHead>
                  <TableHead>Saved (UTC)</TableHead>
                  {questions.map((question, index) => (
                    <TableHead key={question.id} title={question.text}>
                      Q{index + 1}
                    </TableHead>
                  ))}
                  {attentionCheck ? <TableHead>Attention check</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.slice(0, MAX_ROWS).map((response) => (
                  <TableRow key={response.id}>
                    <TableCell className="sticky left-0 bg-card font-mono tabular-nums">
                      {response.seq}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                      <time dateTime={response.createdAt}>
                        {timeFormat.format(new Date(response.createdAt))}
                      </time>
                    </TableCell>
                    {questions.map((question) => (
                      <TableCell key={question.id} className="max-w-48 truncate">
                        {response.answers[question.id]}
                      </TableCell>
                    ))}
                    {attentionCheck ? (
                      <TableCell>
                        {failsAttentionCheck(response, attentionCheck) ? (
                          <span className="text-warning">Failed</span>
                        ) : (
                          <span className="text-muted-foreground">Passed</span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {responses.length > MAX_ROWS ? (
            <p className="text-sm text-muted-foreground">
              Showing the first {MAX_ROWS} of {responses.length} answers. Download the CSV for
              all of them.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
