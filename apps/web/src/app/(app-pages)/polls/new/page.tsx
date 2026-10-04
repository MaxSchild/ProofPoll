import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { PollForm } from '../_components/poll-form';

export const metadata: Metadata = { title: 'New poll' };

export default function NewPollPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="New poll"
        description="Plan your poll. It stays a draft until you open it for answers."
      />
      <PollForm mode="create" />
    </div>
  );
}
