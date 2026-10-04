import { ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EXAMPLE_POLL_ID, PRODUCT_NAME } from '@/constants';

export function HomeHero() {
  return (
    <section>
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-8 pt-16 sm:px-6 sm:pb-12 sm:pt-24 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <div className="max-w-3xl space-y-7">
          <div className="space-y-5">
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
              Nobody records survey answers as they arrive.
            </h1>
            <p className="max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
              {PRODUCT_NAME} keeps a numbered, timestamped record of every answer
              the moment it is given, so reviewers can check that none were
              dropped before the results were published.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Get started
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            {EXAMPLE_POLL_ID ? (
              <Button asChild size="lg" variant="outline">
                <Link href={`/p/${EXAMPLE_POLL_ID}`}>See an example poll</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="hidden shadow-none lg:block" aria-hidden="true">
          <CardContent className="space-y-4 p-6">
            <div className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Thank you.</p>
              <p className="text-sm text-muted-foreground">
                Your answer is <span className="font-mono text-foreground">#17</span> in
                this poll, saved at <span className="font-mono text-foreground">14:03</span>.
              </p>
            </div>
            <p className="border-t pt-4 font-mono text-xs text-muted-foreground">
              poll k3x9ab2q · answer 17 of 100 planned
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
