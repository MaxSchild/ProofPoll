'use client';

import { useAction } from 'next-safe-action/hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { AuthCard } from '@/components/Auth/AuthCard';
import { EmailAndPassword } from '@/components/Auth/EmailAndPassword';
import { EmailConfirmationPendingCard } from '@/components/Auth/EmailConfirmationPendingCard';
import { Button } from '@/components/ui/button';
import { signUpAction } from '@/data/auth/auth';
import { PRODUCT_NAME } from '@/constants';

interface SignUpProps {
  next?: string;
}

export function SignUp({ next }: SignUpProps) {
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const toastRef = useRef<string | number | undefined>(undefined);

  const { execute: executeSignUp, status: signUpStatus } = useAction(
    signUpAction,
    {
      onExecute: () => {
        toastRef.current = toast.loading('Creating account...');
      },
      onSuccess: ({ data }) => {
        toast.success('Account created', { id: toastRef.current });
        toastRef.current = undefined;
        if (data?.signedIn) {
          router.push('/dashboard');
          return;
        }
        setSuccessMessage('A confirmation link has been sent to your email.');
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? 'Failed to create account', {
          id: toastRef.current,
        });
        toastRef.current = undefined;
      },
    }
  );

  if (successMessage) {
    return (
      <EmailConfirmationPendingCard
        type="sign-up"
        heading="Confirmation Link Sent"
        message={successMessage}
        resetSuccessMessage={setSuccessMessage}
      />
    );
  }

  return (
    <AuthCard
      title={`Create your ${PRODUCT_NAME} account`}
      description="Create your account and start with a secure, working foundation."
      footer={
        <p className="w-full text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Button variant="link" className="h-auto px-0" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </p>
      }
    >
      <EmailAndPassword
        isLoading={signUpStatus === 'executing'}
        onSubmit={(data) => executeSignUp({ ...data, next })}
        view="sign-up"
      />
    </AuthCard>
  );
}
