'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  closePollAction,
  deletePollAction,
  openPollAction,
} from '@/data/user/polls';
import { ConfirmActionDialog } from './confirm-action-dialog';

type ActionResult = { serverError?: string; validationErrors?: unknown } | undefined;

function errorOf(result: ActionResult): string | null {
  if (result?.serverError) return result.serverError;
  if (result?.validationErrors) return 'This poll could not be found.';
  return null;
}

export function DraftActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <Link href={`/polls/${id}/edit`}>Edit</Link>
      </Button>
      <ConfirmActionDialog
        trigger={
          <Button variant="outline" className="text-destructive hover:text-destructive">
            Delete
          </Button>
        }
        title="Delete this draft?"
        description="This can't be undone."
        cancelLabel="Keep draft"
        confirmLabel="Delete draft"
        destructive
        onConfirm={async () => {
          const message = errorOf(await deletePollAction({ id }));
          if (!message) {
            toast.success('Draft deleted');
            router.push('/dashboard');
          }
          return message;
        }}
      />
      <ConfirmActionDialog
        trigger={<Button>Open for answers</Button>}
        title={`Open "${title}" for answers?`}
        description="The plan, questions and rules can't be changed after this. Participants will be able to answer straight away."
        cancelLabel="Keep editing"
        confirmLabel="Open for answers"
        onConfirm={async () => {
          const message = errorOf(await openPollAction({ id }));
          if (!message) {
            toast.success('Poll opened');
            router.refresh();
          }
          return message;
        }}
      />
    </div>
  );
}

export function OpenActions({ id }: { id: string }) {
  const router = useRouter();

  return (
    <ConfirmActionDialog
      trigger={
        <Button variant="outline" className="text-destructive hover:text-destructive">
          Close poll
        </Button>
      }
      title="Close this poll?"
      description="No more answers will be accepted. You can still view results and download the data. This can't be undone."
      confirmLabel="Close poll"
      destructive
      onConfirm={async () => {
        const message = errorOf(await closePollAction({ id }));
        if (!message) {
          toast.success('Poll closed');
          router.refresh();
        }
        return message;
      }}
    />
  );
}
