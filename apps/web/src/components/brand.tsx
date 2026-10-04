import { ListChecks } from 'lucide-react';

import { cn } from '@/lib/utils';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@/constants';

interface BrandProps {
  className?: string;
  showTagline?: boolean;
}

export function Brand({ className, showTagline = false }: BrandProps) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ListChecks className="size-4" aria-hidden="true" />
      </span>
      <span className="grid min-w-0 text-left leading-tight">
        <span className="truncate text-base font-semibold tracking-tight">
          {PRODUCT_NAME}
        </span>
        {showTagline ? (
          <span className="truncate text-xs text-muted-foreground">
            {PRODUCT_TAGLINE}
          </span>
        ) : null}
      </span>
    </span>
  );
}
