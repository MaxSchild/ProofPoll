'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Add a tab by adding its name here, a trigger and a TabsContent below. The
// active tab lives in the URL (?tab=), so links to a tab work.
const TABS = ['overview', 'share', 'results', 'record'] as const;
type TabName = (typeof TABS)[number];

export function PollTabs({
  overview,
  share,
  results,
  record,
}: {
  overview: ReactNode;
  share: ReactNode;
  results: ReactNode;
  record: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requested = searchParams.get('tab');
  const tab: TabName = TABS.find((name) => name === requested) ?? 'overview';

  function onTabChange(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList className="h-auto max-w-full justify-start overflow-x-auto">
        <TabsTrigger value="overview" className="h-9 px-4">
          Overview
        </TabsTrigger>
        <TabsTrigger value="share" className="h-9 px-4">
          Share
        </TabsTrigger>
        <TabsTrigger value="results" className="h-9 px-4">
          Results
        </TabsTrigger>
        <TabsTrigger value="record" className="h-9 px-4">
          Record
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-6">
        {overview}
      </TabsContent>
      <TabsContent value="share" className="mt-6">
        {share}
      </TabsContent>
      <TabsContent value="results" className="mt-6">
        {results}
      </TabsContent>
      <TabsContent value="record" className="mt-6">
        {record}
      </TabsContent>
    </Tabs>
  );
}
