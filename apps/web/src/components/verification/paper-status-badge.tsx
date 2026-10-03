import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PAPER_STATUS_LABELS, type PaperStatus } from '@/utils/verification';

const styles: Record<PaperStatus, { badge: string; dot: string }> = {
  draft: { badge: 'border-border text-muted-foreground', dot: 'border border-current' },
  in_review: { badge: 'border-transparent bg-warning-soft text-warning', dot: 'bg-current' },
  published: { badge: 'border-transparent bg-success-soft text-success', dot: 'bg-current' },
};

export function PaperStatusBadge({
  status,
  className,
}: {
  status: PaperStatus;
  className?: string;
}) {
  const { badge, dot } = styles[status];
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', badge, className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', dot)} />
      {PAPER_STATUS_LABELS[status]}
    </Badge>
  );
}
