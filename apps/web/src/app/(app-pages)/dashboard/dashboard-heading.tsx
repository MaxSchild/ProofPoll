import { PageHeader } from '@/components/page-header';

export async function DashboardHeading() {
  'use cache';

  return <PageHeader title="Dashboard" description="Your polls will appear here." />;
}
