'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { Button } from '@/components/ui/button';
import { deletePaperAction } from '@/data/user/papers';

export function DraftPaperActions({ id }: { id: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <Link href={`/my-papers/${id}/edit`}>Edit</Link>
      </Button>
      <ConfirmActionDialog
        trigger={
          <Button variant="outline" className="text-destructive hover:text-destructive">
            Delete
          </Button>
        }
        title="Delete this paper?"
        description="Its polls and their answers stay as they are. This can't be undone."
        cancelLabel="Keep paper"
        confirmLabel="Delete paper"
        destructive
        onConfirm={async () => {
          const result = await deletePaperAction({ id });
          const message = result?.serverError ?? (result?.validationErrors ? 'This paper could not be found.' : null);
          if (!message) {
            toast.success('Paper deleted');
            router.push('/my-papers');
          }
          return message;
        }}
      />
    </div>
  );
}
