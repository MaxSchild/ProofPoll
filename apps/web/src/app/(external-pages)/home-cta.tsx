import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function HomeCTA() {
  return (
    <section className="border-t bg-muted py-14">
      <div className="mx-auto flex max-w-6xl flex-col px-4 sm:px-6 lg:px-8 items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Built for theses and chair studies.
          </h2>
          <p className="leading-7 text-muted-foreground">
            Participants answer on their phone or a lab computer, with no account
            and no app to install.
          </p>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link href="/sign-up">
            Create your first poll
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
