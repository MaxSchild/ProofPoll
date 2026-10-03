import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/page-header';
import { getPaper, getSelectablePolls } from '@/data/user/paper-queries';
import { PaperForm } from '../../_components/paper-form';

export const metadata: Metadata = { title: 'Edit paper · AllCounted' };

export default async function EditPaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const paper = await getPaper(id);
  if (!paper) notFound();
  // Title, authors and polls are fixed once the paper has gone to review.
  if (paper.status !== 'draft') redirect(`/my-papers/${id}`);
  const polls = await getSelectablePolls(id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <PageHeader title="Edit paper" />
      <PaperForm
        mode="edit"
        paperId={paper.id}
        polls={polls}
        defaultValues={{
          title: paper.title,
          authors: paper.authors.map((a) => ({ name: a.name, affiliation: a.affiliation })),
          pollIds: paper.polls.map((poll) => poll.id),
        }}
      />
    </div>
  );
}
