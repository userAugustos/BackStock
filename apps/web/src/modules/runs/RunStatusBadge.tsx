import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

import type { RunStatus } from '@back-stock/api/runs';

import { Badge } from '@repo/ui/shadcn/badge';
import type { BadgeProps } from '@repo/ui/shadcn/badge';

const STATUS_META: Record<
  RunStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']>; spin: boolean; icon: typeof Clock }
> = {
  queued: { label: 'queued', variant: 'muted', spin: false, icon: Clock },
  running: { label: 'running', variant: 'signal', spin: true, icon: Loader2 },
  done: { label: 'done', variant: 'good', spin: false, icon: CheckCircle2 },
  failed: { label: 'failed', variant: 'danger', spin: false, icon: XCircle },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} data-testid={`run-status-${status}`} className="font-mono">
      <Icon className={meta.spin ? 'animate-spin' : undefined} />
      {meta.label}
    </Badge>
  );
}
