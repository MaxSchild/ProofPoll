import { ListChecks } from 'lucide-react';
import Link from 'next/link';

import { PollStatusBadge } from '@/components/poll-status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getMyPolls, type PollListItem } from '@/data/user/poll-queries';
import { formatDate } from '@/utils/format';

function AnswerCount({ poll }: { poll: PollListItem }) {
  return (
    <span className="font-mono tabular-nums">
      {poll.answerCount}
      {poll.plannedN ? ` / ${poll.plannedN}` : ''}
    </span>
  );
}

function CreatedDate({ createdAt }: { createdAt: string }) {
  return <time dateTime={createdAt}>{formatDate(createdAt)}</time>;
}

export async function PollList() {
  const polls = await getMyPolls();

  if (polls.length === 0) {
    return (
      <Empty className="flex-none border bg-card py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="rounded-full">
            <ListChecks aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No polls yet</EmptyTitle>
          <EmptyDescription>
            Create a poll, share the link or QR code, and collect answers.
            Every answer gets a number and a timestamp.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/polls/new">Create your first poll</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <>
      <div className="hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Answers</TableHead>
              <TableHead className="pr-4">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {polls.map((poll) => (
              <TableRow key={poll.id} className="relative">
                <TableCell className="max-w-0 pl-4 font-medium">
                  <Link
                    href={`/polls/${poll.id}`}
                    className="block truncate rounded-sm after:absolute after:inset-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {poll.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <PollStatusBadge status={poll.status} />
                </TableCell>
                <TableCell className="w-40">
                  <AnswerCount poll={poll} />
                  {poll.plannedN ? (
                    <Progress
                      aria-hidden="true"
                      value={Math.min(
                        100,
                        (poll.answerCount / poll.plannedN) * 100
                      )}
                      className="mt-1.5 h-1 w-24 bg-muted"
                    />
                  ) : null}
                </TableCell>
                <TableCell className="pr-4 text-muted-foreground">
                  <CreatedDate createdAt={poll.createdAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {polls.map((poll) => (
          <li key={poll.id}>
            <Card className="relative gap-2 p-4 shadow-none">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/polls/${poll.id}`}
                  className="min-w-0 break-words font-medium after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
                >
                  {poll.title}
                </Link>
                <PollStatusBadge status={poll.status} className="shrink-0" />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  <AnswerCount poll={poll} />
                  <span className="ml-1">answers</span>
                </span>
                <CreatedDate createdAt={poll.createdAt} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

export function PollListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
