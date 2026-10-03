import { Plus } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export async function DashboardHeading() {
  'use cache';

  return (
    <PageHeader
      title="Your polls"
      actions={
        <Button asChild>
          <Link href="/polls/new">
            <Plus aria-hidden="true" />
            New poll
          </Link>
        </Button>
      }
    />
  );
}
