'use client';

import { useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';

export function LabBadge() {
  const lab = useSearchParams().get('lab') === '1';
  if (!lab) return null;
  return <Badge variant="outline">Lab mode</Badge>;
}
