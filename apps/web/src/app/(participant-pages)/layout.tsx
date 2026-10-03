import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';

import { Brand } from '@/components/brand';
import { Skeleton } from '@/components/ui/skeleton';
import { LabBadge } from './lab-badge';

// Participants arrive from a shared link or QR code; keep the page out of
// search results.
export const metadata: Metadata = {
  title: 'Answer a poll',
  robots: { index: false, follow: false },
};

export default function ParticipantLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-14 items-center justify-between gap-3 px-4 text-muted-foreground sm:px-6">
        <Link href="/" aria-label="AllCounted home" className="min-w-0 rounded-md">
          <Brand />
        </Link>
        <Suspense fallback={null}>
          <LabBadge />
        </Suspense>
      </header>
      <main className="mx-auto flex w-full flex-1 flex-col">
        <Suspense
          fallback={
            <div aria-busy="true" className="mx-auto w-full max-w-[640px] space-y-4 px-4 py-6 sm:py-12">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}
