import type { Dispatch } from 'react';

import { Progress } from '@repo/ui/shadcn/progress';
import { cn } from '@repo/ui/utils';
import { getEventMeta } from '@/modules/days/eventMeta';
import { TransportControls } from '@/modules/runs/replay/TransportControls';
import type { EventMarker } from '@/modules/runs/replay/replay.derive';
import type { PlaybackAction, PlaybackState } from '@/modules/runs/replay/usePlayback';

interface TimelineProps {
  state: PlaybackState;
  dispatch: Dispatch<PlaybackAction>;
  stepCount: number;
  markers: EventMarker[];
}

/**
 * Simplest possible flight recorder: a Progress rail with the event icons
 * laid evenly on top, driven only by the transport controls. Step 0 sits at
 * 0% (before any event); step i+1 lands on marker i at `i / (N-1) * 100%`.
 */
export function Timeline({ state, dispatch, stepCount, markers }: TimelineProps) {
  const lastIndex = Math.max(stepCount - 1, 0);
  const markerCount = markers.length;

  // Active marker = the icon the current step landed on, or -1 at step 0
  // (before any event has been applied).
  const activeMarker = state.index - 1;
  const progressPct =
    activeMarker < 0 || markerCount < 2 ? 0 : (activeMarker / (markerCount - 1)) * 100;

  return (
    <div className="space-y-5" data-testid="replay-timeline">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TransportControls state={state} dispatch={dispatch} stepCount={stepCount} />
        <div className="text-muted-foreground font-mono text-xs tabular-nums">
          step{' '}
          <span className="text-foreground" data-testid="timeline-step-readout">
            {state.index}
          </span>{' '}
          / {lastIndex}
        </div>
      </div>

      {/* Padded so the edge icons aren't clipped by the card edge. */}
      <div className="relative px-4 pt-2 pb-2">
        <Progress value={progressPct} data-testid="timeline-progress" />

        {/* Decorative event markers — not interactive; use transport controls to seek. */}
        {markers.map((marker, idx) => {
          const meta = getEventMeta(marker.type);
          const Icon = meta.icon;
          const left = markerCount > 1 ? (idx / (markerCount - 1)) * 100 : 50;
          const isActive = idx === activeMarker;
          return (
            <span
              key={`${marker.seq}-${marker.type}`}
              aria-hidden
              data-testid={`timeline-event-${marker.seq}`}
              data-state={isActive ? 'active' : undefined}
              style={{ left: `${left}%` }}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <span
                className={cn(
                  'border-background grid size-7 place-items-center rounded-full border-2 shadow-[var(--elevation-1)] [&_svg]:size-3.5',
                  markerTone(meta.variant),
                  isActive && 'ring-primary ring-offset-background ring-2 ring-offset-2'
                )}
              >
                <Icon />
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function markerTone(variant: ReturnType<typeof getEventMeta>['variant']): string {
  switch (variant) {
    case 'good':
      return 'bg-[var(--good)]/20 text-[var(--good)]';
    case 'warning':
      return 'bg-[var(--warning)]/20 text-[var(--warning)]';
    case 'danger':
      return 'bg-[var(--danger)]/20 text-[var(--danger)]';
    case 'info':
      return 'bg-[var(--info)]/20 text-[var(--info)]';
    case 'signal':
      return 'bg-primary/20 text-primary';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
