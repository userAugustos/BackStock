import { m } from 'motion/react';
import type { Dispatch } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/shadcn/tooltip';
import { cn } from '@repo/ui/utils';
import { getEventMeta } from '@/modules/days/eventMeta';
import { HOUR_TICKS, stepToPosition } from '@/modules/runs/replay/replay.derive';
import { TransportControls } from '@/modules/runs/replay/TransportControls';
import type { EventMarker } from '@/modules/runs/replay/replay.derive';
import type { PlaybackAction, PlaybackState } from '@/modules/runs/replay/usePlayback';

interface TimelineProps {
  state: PlaybackState;
  dispatch: Dispatch<PlaybackAction>;
  stepCount: number;
  markers: EventMarker[];
}

const STORE_OPEN_LABEL = '08:00';
const STORE_CLOSE_LABEL = '22:00';

export function Timeline({ state, dispatch, stepCount, markers }: TimelineProps) {
  const playheadPct = stepToPosition(state.index, stepCount) * 100;
  const lastIndex = Math.max(stepCount - 1, 0);

  return (
    <div className="space-y-4" data-testid="replay-timeline">
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

      <div className="relative px-1 pt-6 pb-2">
        {/* Rail */}
        <div className="bg-background/70 relative h-2 rounded-full ring-1 ring-white/[0.05]">
          <m.div
            className="bg-primary/70 absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${playheadPct}%` }}
            animate={{ width: `${playheadPct}%` }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
            data-testid="timeline-progress"
          />

          {/* Event markers */}
          {markers.map((marker) => {
            const meta = getEventMeta(marker.type);
            const Icon = meta.icon;
            const isActive = state.index === marker.stepIndex;
            return (
              <Tooltip key={`${marker.seq}-${marker.type}`}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-testid={`timeline-event-${marker.seq}`}
                    data-state={isActive ? 'active' : undefined}
                    onClick={() => dispatch({ type: 'seek', index: marker.stepIndex })}
                    aria-label={`${meta.label} at ${marker.at}`}
                    style={{ left: `${marker.position * 100}%` }}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        'border-background grid size-7 place-items-center rounded-full border-2 shadow-[var(--elevation-1)] transition-transform duration-150 hover:scale-110 active:scale-95 [&_svg]:size-3.5',
                        markerTone(meta.variant),
                        isActive && 'ring-primary ring-offset-background ring-2 ring-offset-2'
                      )}
                    >
                      <Icon />
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <span className="font-mono text-xs">
                    {marker.at} · {meta.label}
                  </span>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Playhead */}
          <m.div
            data-testid="timeline-playhead"
            className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 [will-change:transform]"
            style={{ left: `${playheadPct}%` }}
            animate={{ left: `${playheadPct}%` }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
          >
            <span className="bg-primary ring-primary/30 block size-4 rounded-full shadow-[0_0_0_4px_var(--background),var(--elevation-2)] ring-4" />
          </m.div>
        </div>

        {/* Native scrubber overlaid on the rail for keyboard + drag */}
        <input
          type="range"
          data-testid="timeline-scrubber"
          min={0}
          max={lastIndex}
          step={1}
          value={state.index}
          onChange={(event) => dispatch({ type: 'seek', index: Number(event.target.value) })}
          aria-label="Scrub timeline"
          aria-valuetext={`Step ${state.index} of ${lastIndex}`}
          className="absolute inset-x-1 top-6 h-2 cursor-pointer appearance-none bg-transparent opacity-0"
        />

        {/* Hour axis */}
        <div className="text-muted-foreground/70 relative mt-4 h-4 font-mono text-[10px] tabular-nums">
          {HOUR_TICKS.map((hour, idx) => {
            if (idx % 2 !== 0 && hour !== HOUR_TICKS[HOUR_TICKS.length - 1]) return null;
            const pct = (idx / (HOUR_TICKS.length - 1)) * 100;
            return (
              <span key={hour} className="absolute -translate-x-1/2" style={{ left: `${pct}%` }}>
                {String(hour).padStart(2, '0')}:00
              </span>
            );
          })}
        </div>
      </div>

      <div className="text-muted-foreground/60 flex justify-between font-mono text-[10px] tabular-nums">
        <span>{STORE_OPEN_LABEL} open</span>
        <span>{STORE_CLOSE_LABEL} close</span>
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
