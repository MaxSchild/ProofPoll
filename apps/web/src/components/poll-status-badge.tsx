import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PollStatus } from '@/utils/polls';

const statuses: Record<
  PollStatus,
  { label: string; badge: string; dot: string }
> = {
  draft: {
    label: 'Draft',
    badge: 'border-border text-muted-foreground',
    dot: 'border border-current',
  },
  open: {
    label: 'Open',
    badge: 'border-transparent bg-success-soft text-success',
    dot: 'bg-current',
  },
  closed: {
    label: 'Closed',
    badge: 'border-transparent bg-secondary text-secondary-foreground',
    dot: 'bg-current',
  },
};

export function PollStatusBadge({
  status,
  className,
}: {
  status: PollStatus;
  className?: string;
}) {
  const { label, badge, dot } = statuses[status];
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 font-medium', badge, className)}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', dot)} />
      {label}
    </Badge>
  );
}
