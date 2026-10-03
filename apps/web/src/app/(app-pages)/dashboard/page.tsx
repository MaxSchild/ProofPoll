import type { Metadata } from 'next';
import { Suspense } from 'react';

import { DashboardHeading } from './dashboard-heading';
import { PollList, PollListSkeleton } from './poll-list';

export const metadata: Metadata = { title: 'Your polls · AllCounted' };

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <DashboardHeading />
      <Suspense fallback={<PollListSkeleton />}>
        <PollList />
      </Suspense>
    </div>
  );
}
