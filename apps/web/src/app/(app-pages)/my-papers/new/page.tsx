import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { getSelectablePolls } from '@/data/user/paper-queries';
import { PaperForm } from '../_components/paper-form';

export const metadata: Metadata = { title: 'New paper' };

async function NewPaperForm() {
  const polls = await getSelectablePolls(null);
  return <PaperForm mode="create" polls={polls} />;
}

export default function NewPaperPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="New paper"
        description="Group the polls behind a manuscript. Reviewers and readers can then check that the paper reports the data as it was recorded."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <NewPaperForm />
      </Suspense>
    </div>
  );
}
