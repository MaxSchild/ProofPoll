'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { recordMissingAction } from '@/data/user/polls';

export function RetryRecordsButton({ pollId, count }: { pollId: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      const result = await recordMissingAction({ id: pollId });
      if (result?.serverError) toast.error(result.serverError);
      else if (result?.data?.remaining) {
        toast.warning(`${result.data.remaining} still not recorded. Try again in a minute.`);
      } else toast.success('Everything is recorded on Solana');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={retry} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      Record {count} missing on Solana
    </Button>
  );
}
