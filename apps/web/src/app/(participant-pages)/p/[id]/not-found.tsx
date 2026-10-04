import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { PRODUCT_NAME } from '@/constants';

export default function PollNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 items-center px-4 py-6 sm:py-12">
      <div className="flex w-full flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Poll not found.</h1>
        <p className="text-muted-foreground">
          Check the link or ask the person who shared it for a new one.
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/">Go to {PRODUCT_NAME}</Link>
        </Button>
      </div>
    </div>
  );
}
