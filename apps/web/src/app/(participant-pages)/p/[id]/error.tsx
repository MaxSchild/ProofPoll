'use client';

import { RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function AnswerPageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="space-y-4 sm:rounded-xl sm:border sm:bg-card sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">This poll couldn&apos;t be loaded.</h1>
      <p className="text-muted-foreground">
        Check your connection and try again. Nothing you entered has been saved yet.
      </p>
      <Button type="button" onClick={reset} className="h-12">
        <RotateCw aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
