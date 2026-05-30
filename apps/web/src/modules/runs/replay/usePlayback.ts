import { useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';

export type PlaybackStatus = 'playing' | 'paused';

export const PLAYBACK_SPEEDS = [0.5, 1, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** Base tick interval in ms at 1x; higher speeds divide this. */
const BASE_TICK_MS = 900;

export interface PlaybackState {
  status: PlaybackStatus;
  index: number;
  speed: PlaybackSpeed;
}

export type PlaybackAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'advance' }
  | { type: 'stepForward' }
  | { type: 'stepBack' }
  | { type: 'seek'; index: number }
  | { type: 'restart' }
  | { type: 'cycleSpeed' };

interface PlaybackConfig {
  /** Number of timeline steps (indices 0..stepCount-1). */
  stepCount: number;
}

const clampIndex = (index: number, stepCount: number): number =>
  Math.min(Math.max(index, 0), Math.max(stepCount - 1, 0));

const isLastIndex = (index: number, stepCount: number): boolean => index >= stepCount - 1;

const nextSpeed = (speed: PlaybackSpeed): PlaybackSpeed => {
  const at = PLAYBACK_SPEEDS.indexOf(speed);
  return PLAYBACK_SPEEDS[(at + 1) % PLAYBACK_SPEEDS.length] ?? 1;
};

function reducer(config: PlaybackConfig) {
  return (state: PlaybackState, action: PlaybackAction): PlaybackState => {
    const { stepCount } = config;
    switch (action.type) {
      case 'play':
        return isLastIndex(state.index, stepCount)
          ? { ...state, status: 'playing', index: 0 }
          : { ...state, status: 'playing' };
      case 'pause':
        return { ...state, status: 'paused' };
      case 'toggle':
        if (state.status === 'playing') return { ...state, status: 'paused' };
        return isLastIndex(state.index, stepCount)
          ? { ...state, status: 'playing', index: 0 }
          : { ...state, status: 'playing' };
      case 'advance': {
        if (isLastIndex(state.index, stepCount)) return { ...state, status: 'paused' };
        return { ...state, index: state.index + 1 };
      }
      case 'stepForward':
        return { ...state, status: 'paused', index: clampIndex(state.index + 1, stepCount) };
      case 'stepBack':
        return { ...state, status: 'paused', index: clampIndex(state.index - 1, stepCount) };
      case 'seek':
        return { ...state, status: 'paused', index: clampIndex(action.index, stepCount) };
      case 'restart':
        return { ...state, status: 'paused', index: 0 };
      case 'cycleSpeed':
        return { ...state, speed: nextSpeed(state.speed) };
      default:
        return state;
    }
  };
}

export function usePlayback(stepCount: number) {
  return useReducer(reducer({ stepCount }), {
    status: 'paused',
    index: 0,
    speed: 1,
  } satisfies PlaybackState);
}

/**
 * Drives the auto-advance timer while playing. This is the ONE sanctioned
 * effect on the screen: it owns a wall-clock interval, not data or derivations.
 */
export function usePlaybackLoop(state: PlaybackState, dispatch: Dispatch<PlaybackAction>): void {
  const { status, speed } = state;
  useEffect(() => {
    if (status !== 'playing') return;
    const interval = window.setInterval(() => dispatch({ type: 'advance' }), BASE_TICK_MS / speed);
    return () => window.clearInterval(interval);
  }, [status, speed, dispatch]);
}
