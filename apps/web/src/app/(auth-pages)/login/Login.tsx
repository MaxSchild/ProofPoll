'use client';

import { useAction } from 'next-safe-action/hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { AuthCard } from '@/components/Auth/AuthCard';
import { EmailAndPassword } from '@/components/Auth/EmailAndPassword';
import { RedirectingPleaseWaitCard } from '@/components/Auth/RedirectingPleaseWaitCard';
import { Button } from '@/components/ui/button';
import { signInWithPasswordAction } from '@/data/auth/auth';

export function Login({ next }: { next?: string }) {
  const [redirectInProgress, setRedirectInProgress] = useState(false);
  const toastRef = useRef<string | number | undefined>(undefined);
  const router = useRouter();

  function redirectToDashboard() {
    router.push(next ? `/auth/callback?next=${next}` : '/dashboard');
  }

  const { execute: executePassword, status: passwordStatus } = useAction(
    signInWithPasswordAction,
    {
      onExecute: () => {
        toastRef.current = toast.loading('Signing in...');
      },
      onSuccess: () => {
        toast.success('Signed in', { id: toastRef.current });
        toastRef.current = undefined;
        redirectToDashboard();
        setRedirectInProgress(true);
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? 'Failed to sign in', {
          id: toastRef.current,
        });
        toastRef.current = undefined;
      },
    }
  );

  if (redirectInProgress) {
    return (
      <RedirectingPleaseWaitCard
        message="Please wait while we open your protected workspace."
        heading="Opening your dashboard"
      />
    );
  }

  return (
    <AuthCard
      title="Sign in to AllCounted"
      description="Sign in with your email and password."
      footer={
        <p className="w-full text-center text-sm text-muted-foreground">
          New to AllCounted?{' '}
          <Button variant="link" className="h-auto px-0" asChild>
            <Link href="/sign-up">Create an account</Link>
          </Button>
        </p>
      }
    >
      <EmailAndPassword
        isLoading={passwordStatus === 'executing'}
        onSubmit={(data) => executePassword(data)}
        view="sign-in"
      />
    </AuthCard>
  );
}
