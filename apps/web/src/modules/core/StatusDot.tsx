import { useQuery } from '@tanstack/react-query';

import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/shadcn/tooltip';
import { cn } from '@repo/ui/utils';
import { healthQueryOptions } from '@/modules/core/health.queries';

type HealthState = 'ok' | 'error' | 'idle';

const STATE_STYLES: Record<HealthState, { dot: string; ring: string; label: string }> = {
  ok: { dot: 'bg-primary', ring: 'bg-primary/40', label: 'ok' },
  error: { dot: 'bg-[var(--danger)]', ring: 'bg-[var(--danger)]/40', label: 'offline' },
  idle: { dot: 'bg-muted-foreground', ring: 'bg-muted-foreground/30', label: 'connecting' },
};

export function StatusDot() {
  const { data, isError, isPending } = useQuery(healthQueryOptions());

  const state: HealthState = isPending ? 'idle' : isError || data?.status !== 'ok' ? 'error' : 'ok';
  const styles = STATE_STYLES[state];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="api-status"
          data-status={styles.label}
          className="inline-flex items-center gap-2 text-xs"
          aria-label={`API ${styles.label}`}
        >
          <span className="relative inline-flex size-2.5">
            {state === 'ok' && (
              <span
                className={cn(
                  'absolute inline-flex h-full w-full animate-ping rounded-full',
                  styles.ring
                )}
              />
            )}
            <span className={cn('relative inline-flex size-2.5 rounded-full', styles.dot)} />
          </span>
          <span className="text-muted-foreground font-mono tracking-wider uppercase">
            {styles.label}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        API {styles.label}
        {data?.version ? <span className="ml-1 font-mono opacity-70">{data.version}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
