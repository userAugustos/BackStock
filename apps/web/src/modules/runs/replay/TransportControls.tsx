import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import type { Dispatch } from 'react';

import { cn } from '@repo/ui/utils';
import type { PlaybackAction, PlaybackState } from '@/modules/runs/replay/usePlayback';

interface TransportControlsProps {
  state: PlaybackState;
  dispatch: Dispatch<PlaybackAction>;
  stepCount: number;
}

interface TransportButtonProps {
  label: string;
  testid: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}

function TransportButton({
  label,
  testid,
  onClick,
  disabled,
  active,
  children,
}: TransportButtonProps) {
  return (
    <button
      type="button"
      data-testid={testid}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'focus-visible:ring-ring inline-flex size-10 items-center justify-center rounded-xl ring-1 transition-[transform,background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[18px]',
        active
          ? 'bg-primary text-primary-foreground ring-primary/40 shadow-[var(--elevation-1)]'
          : 'bg-foreground/[0.04] text-foreground hover:bg-accent ring-border/60'
      )}
    >
      {children}
    </button>
  );
}

export function TransportControls({ state, dispatch, stepCount }: TransportControlsProps) {
  const isPlaying = state.status === 'playing';
  const atStart = state.index <= 0;
  const atEnd = state.index >= stepCount - 1;

  return (
    <div className="flex items-center gap-2" data-testid="transport-controls">
      <TransportButton
        label="Restart"
        testid="transport-restart"
        onClick={() => dispatch({ type: 'restart' })}
        disabled={atStart && state.status === 'paused'}
      >
        <RotateCcw />
      </TransportButton>

      <TransportButton
        label="Step back"
        testid="transport-step-back"
        onClick={() => dispatch({ type: 'stepBack' })}
        disabled={atStart}
      >
        <SkipBack />
      </TransportButton>

      <TransportButton
        label={isPlaying ? 'Pause' : 'Play'}
        testid="transport-play-pause"
        onClick={() => dispatch({ type: 'toggle' })}
        active={isPlaying}
      >
        {isPlaying ? <Pause /> : <Play />}
      </TransportButton>

      <TransportButton
        label="Step forward"
        testid="transport-step-forward"
        onClick={() => dispatch({ type: 'stepForward' })}
        disabled={atEnd}
      >
        <SkipForward />
      </TransportButton>

      <button
        type="button"
        data-testid="transport-speed"
        aria-label={`Playback speed ${state.speed}x`}
        title="Cycle playback speed"
        onClick={() => dispatch({ type: 'cycleSpeed' })}
        className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] bg-foreground/[0.04] focus-visible:ring-ring ring-border/60 inline-flex h-10 items-center justify-center rounded-xl px-3 font-mono text-xs tabular-nums ring-1 transition-[transform,color,background-color] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.96]"
      >
        {state.speed}x
      </button>
    </div>
  );
}
