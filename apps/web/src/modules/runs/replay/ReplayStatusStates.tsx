import { Radar, XCircle } from 'lucide-react';
import { m } from 'motion/react';

import type { RunStatus } from '@back-stock/api/runs';

import { Badge } from '@repo/ui/shadcn/badge';

interface ExecutingStateProps {
  status: Extract<RunStatus, 'queued' | 'running'>;
}

export function ExecutingState({ status }: ExecutingStateProps) {
  const message =
    status === 'queued'
      ? 'Waiting for a worker to pick up this run.'
      : 'Replaying the day through the agents.';

  return (
    <div
      data-testid="replay-executing"
      className="bg-card ring-foreground/[0.05] flex flex-col items-center gap-5 rounded-2xl p-12 text-center shadow-[var(--elevation-1)] ring-1"
    >
      <div className="relative grid size-20 place-items-center">
        <m.span
          className="border-primary/30 absolute inset-0 rounded-full border"
          animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        />
        <m.span
          className="bg-primary/10 text-primary grid size-14 place-items-center rounded-full [&_svg]:size-6"
          animate={{ rotate: 360 }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
        >
          <Radar />
        </m.span>
      </div>

      <div className="space-y-2">
        <Badge variant="signal" data-testid={`replay-executing-${status}`} className="font-mono">
          {status}
        </Badge>
        <p className="text-muted-foreground text-sm">{message}</p>
        <p className="text-muted-foreground/60 font-mono text-xs">
          This view updates automatically when the run completes.
        </p>
      </div>
    </div>
  );
}

interface FailedStateProps {
  message?: string;
}

export function FailedState({ message }: FailedStateProps) {
  return (
    <div
      data-testid="replay-failed"
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/[0.06] p-12 text-center"
    >
      <XCircle className="size-7 text-[var(--danger)]" />
      <div>
        <p className="font-display text-foreground font-bold">Run failed</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {message ?? 'This run did not finish, so there is no timeline to replay.'}
        </p>
      </div>
    </div>
  );
}
