import { AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@repo/ui/shadcn/button';
import { cn } from '@repo/ui/utils';

interface ErrorPanelProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  testid?: string;
  className?: string;
}

export function ErrorPanel({
  title = 'Something went wrong',
  message,
  onRetry,
  testid = 'error-panel',
  className,
}: ErrorPanelProps) {
  return (
    <div
      data-testid={testid}
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/[0.06] p-8 text-center',
        className
      )}
    >
      <AlertTriangle className="size-6 text-[var(--danger)]" />
      <div>
        <p className="font-display text-foreground font-bold">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} data-testid={`${testid}-retry`}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

interface EmptyPanelProps {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
  testid?: string;
  className?: string;
}

export function EmptyPanel({
  title,
  message,
  icon,
  action,
  testid = 'empty-panel',
  className,
}: EmptyPanelProps) {
  return (
    <div
      data-testid={testid}
      className={cn(
        'border-border/80 bg-foreground/[0.02] flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center',
        className
      )}
    >
      <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-xl">
        {icon ?? <Inbox className="size-5" />}
      </span>
      <div>
        <p className="font-display text-foreground font-bold">{title}</p>
        {message ? <p className="text-muted-foreground mt-1 text-sm">{message}</p> : null}
      </div>
      {action}
    </div>
  );
}
