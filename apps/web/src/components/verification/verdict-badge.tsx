import { CircleCheck, CircleHelp, CircleX } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { VERDICT_LABELS, type Verdict } from '@/utils/verification';

const styles: Record<Verdict, { className: string; Icon: typeof CircleCheck }> = {
  consistent: { className: 'border-transparent bg-success-soft text-success', Icon: CircleCheck },
  inconsistent: {
    className: 'border-transparent bg-destructive/10 text-destructive',
    Icon: CircleX,
  },
  not_checkable: { className: 'border-border text-muted-foreground', Icon: CircleHelp },
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const { className: style, Icon } = styles[verdict];
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', style, className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {VERDICT_LABELS[verdict]}
    </Badge>
  );
}
