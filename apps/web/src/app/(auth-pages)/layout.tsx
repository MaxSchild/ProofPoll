import { CheckCircle2, ListChecks, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Brand } from '@/components/brand';
import { Badge } from '@/components/ui/badge';
import { ModeToggle } from '@/components/ui/mode-toggle';
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';

const benefits = [
  'Register your plan before the first answer',
  'Every answer is numbered and timestamped',
  'Nobody can change or delete an answer',
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex min-h-svh flex-col">
        <header className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="AllCounted home">
            <Brand />
          </Link>
          <ModeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <footer className="px-6 py-5 text-center text-xs text-muted-foreground">
          Every answer, counted.
        </footer>
      </div>

      <aside className="relative hidden overflow-hidden border-l bg-muted/30 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Badge variant="outline" className="relative w-fit bg-background">
          For theses and research studies
        </Badge>
        <div className="relative max-w-lg space-y-8">
          <div className="space-y-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ListChecks className="size-6" aria-hidden="true" />
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight">
              Show reviewers that your data is complete.
            </h1>
            <p className="text-lg leading-8 text-muted-foreground">
              Create a poll, share it with participants, and keep a record of
              every answer from the moment it arrives.
            </p>
          </div>
          <ItemGroup className="gap-2">
            {benefits.map((benefit) => (
              <Item key={benefit} variant="outline" className="bg-background/70">
                <ItemMedia variant="icon">
                  <CheckCircle2 aria-hidden="true" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{benefit}</ItemTitle>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </div>
        <div className="relative flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Answers stay private to the poll's owner
        </div>
      </aside>
    </div>
  );
}
