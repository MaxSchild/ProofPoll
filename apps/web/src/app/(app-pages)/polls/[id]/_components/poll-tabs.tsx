'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Add a tab by adding its name here, a trigger and a TabsContent below. The
// active tab lives in the URL (?tab=), so links to a tab work.
const TABS = ['overview'] as const;
type TabName = (typeof TABS)[number];

export function PollTabs({ overview }: { overview: ReactNode }) {
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
        <TabsTrigger value="share" className="h-9 px-4" disabled>
          Share
        </TabsTrigger>
        <TabsTrigger value="results" className="h-9 px-4" disabled>
          Results
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-6">
        {overview}
      </TabsContent>
    </Tabs>
  );
}
