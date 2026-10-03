import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/page-header';
import { getPoll } from '@/data/user/poll-queries';
import { pollToFormValues } from '@/utils/polls';
import { PollForm } from '../../_components/poll-form';

export const metadata: Metadata = { title: 'Edit poll · AllCounted' };

export default async function EditPollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const poll = await getPoll(id);
  if (!poll) notFound();
  if (poll.status !== 'draft') redirect(`/polls/${id}`);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="Edit poll"
        description="You can change anything until you open the poll for answers."
      />
      <PollForm
        mode="edit"
        pollId={poll.id}
        defaultValues={pollToFormValues({
          title: poll.title,
          description: poll.description,
          planned_n: poll.plannedN,
          questions: poll.questions,
          exclusion_rules: poll.exclusionRules,
          authors: poll.authors,
          attentionCheck: poll.attentionCheck,
        })}
      />
    </div>
  );
}
