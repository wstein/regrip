import { interval } from 'rxjs';
import type { Subscription } from 'rxjs';
import { now as deviceNow } from 'smartcube-web-bluetooth';
import type { SmartCubeMoveEvent } from 'smartcube-web-bluetooth';
import * as SmartCubeBindings from '@wstein/regrip-core/bindings/Bindings_SmartCube.res.mjs';
import * as MoveBuffer from '@wstein/regrip-core/domain/MoveBuffer';
import * as Time from '@wstein/regrip-core/domain/Time';
import * as Timer from '@wstein/regrip-core/domain/Timer.res.mjs';

export function createLocalTimer(
  setValue: (milliseconds: number) => void,
  clock: () => number = deviceNow,
) {
  let subscription: Subscription | null = null;
  let startedAt: number | undefined;
  let lastElapsed = 0;

  const refresh = (): void => {
    if (startedAt !== undefined) setValue(clock() - startedAt);
  };

  return {
    start(): void {
      startedAt = clock();
      lastElapsed = 0;
      subscription?.unsubscribe();
      subscription = interval(30).subscribe(refresh);
    },
    stop(): number {
      subscription?.unsubscribe();
      subscription = null;
      lastElapsed = startedAt !== undefined ? clock() - startedAt : 0;
      startedAt = undefined;
      return lastElapsed;
    },
    getElapsed(): number {
      return startedAt !== undefined ? clock() - startedAt : lastElapsed;
    },
    refresh,
  };
}

type TimerControllerOptions = {
  isConnected: () => boolean;
  /** Injected by deterministic replay; live sessions use the device clock. */
  now?: () => number;
  setTimer: (value: string) => void;
  showTimer: (show: boolean) => void;
  setTimerColor: (color: string) => void;
  setSkew: (value: string) => void;
  setPhase?: (phase: Timer.Phase | 'idle', finalTime?: string) => void;
  setTps?: (tps: number | null) => void;
};

const PHASE_COLOR: Record<Timer.Phase, string> = {
  ready: '#0f0',
  running: '#999',
  stopped: '#fff',
};

export function createTimerController(options: TimerControllerOptions) {
  let state: Timer.State = 'idle';
  let moves = MoveBuffer.initial<SmartCubeMoveEvent>();
  const setTimerValue = (milliseconds: number) => options.setTimer(Time.format(milliseconds));
  const localTimer = createLocalTimer(setTimerValue, options.now);

  function applyEffect(effect: Timer.Effect): void {
    if (typeof effect === 'string') {
      switch (effect) {
        case 'showTimer':
          options.showTimer(true);
          break;
        case 'hideTimer':
          options.showTimer(false);
          break;
        case 'startLocalTimer':
          localTimer.start();
          break;
        case 'stopLocalTimer':
          localTimer.stop();
          break;
        case 'clearSolutionMoves':
          moves = MoveBuffer.clearSolution(moves);
          break;
        case 'showFinalTime': {
          const solutionMoves = MoveBuffer.solutionMoves(moves);
          let finalMs = 0;
          if (
            solutionMoves.length > 0 &&
            solutionMoves.every((move) => move.cubeTimestamp !== null)
          ) {
            const fitted = SmartCubeBindings.cubeTimestampLinearFit(solutionMoves);
            finalMs = fitted.at(-1)?.cubeTimestamp ?? 0;
            setTimerValue(finalMs);
          }
          if (finalMs <= 0) {
            finalMs = localTimer.getElapsed();
          }
          const formatted = finalMs > 0 ? Time.format(finalMs) : undefined;
          options.setPhase?.('stopped', formatted);
          if (solutionMoves.length > 0 && finalMs > 0) {
            options.setTps?.(solutionMoves.length / (finalMs / 1000));
          }
          break;
        }
      }
      return;
    }
    switch (effect.kind) {
      case 'setPhase':
        options.setTimerColor(PHASE_COLOR[effect.phase]);
        if (effect.phase !== 'stopped') {
          options.setPhase?.(effect.phase);
        }
        break;
      case 'setValueMs':
        setTimerValue(effect.ms);
        break;
    }
  }

  function dispatch(input: Timer.Input): void {
    const [next, effects] = Timer.step(state, input, options.isConnected());
    const prev = state;
    state = next;
    effects.forEach(applyEffect);
    if (next === 'idle' && prev !== 'idle') {
      options.setPhase?.('idle');
      options.setTps?.(null);
    }
  }

  function onMove(move: SmartCubeMoveEvent): void {
    dispatch('moveDetected');
    if (move.cubeTimestamp === null) {
      options.setSkew('- n/a - (cube clock unavailable)');
    } else {
      moves = MoveBuffer.pushRecent(moves, move);
    }
    if (state === 'running') moves = MoveBuffer.pushSolution(moves, move);
    if (MoveBuffer.recentReady(moves)) {
      options.setSkew(`${SmartCubeBindings.cubeTimestampCalcSkew(MoveBuffer.recentMoves(moves))}%`);
    }
  }

  function reset(): void {
    moves = MoveBuffer.reset(moves);
    dispatch('disconnected');
    options.setPhase?.('idle');
    options.setTps?.(null);
  }

  return { dispatch, onMove, reset, refresh: localTimer.refresh };
}

export type TimerController = ReturnType<typeof createTimerController>;
