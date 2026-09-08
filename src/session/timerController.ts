import { interval } from 'rxjs';
import type { Subscription } from 'rxjs';
import { now } from 'smartcube-web-bluetooth';
import type { SmartCubeMoveEvent } from 'smartcube-web-bluetooth';
import * as SmartCubeBindings from './Bindings_SmartCube.res.mjs';
import * as MoveBuffer from '../domain/MoveBuffer.res.mjs';
import * as Time from '../domain/Time.res.mjs';
import * as Timer from '../domain/Timer.res.mjs';

export function createLocalTimer(setValue: (milliseconds: number) => void) {
  let subscription: Subscription | null = null;

  return {
    start(): void {
      const startedAt = now();
      subscription?.unsubscribe();
      subscription = interval(30).subscribe(() => setValue(now() - startedAt));
    },
    stop(): void {
      subscription?.unsubscribe();
      subscription = null;
    },
  };
}

type TimerControllerOptions = {
  isConnected: () => boolean;
  setTimer: (value: string) => void;
  showTimer: (show: boolean) => void;
  setTimerColor: (color: string) => void;
  setSkew: (value: string) => void;
};

const PHASE_COLOR: Record<Timer.Phase, string> = {
  ready: '#0f0',
  running: '#999',
  stopped: '#fff',
};

export function createTimerController(options: TimerControllerOptions) {
  let state: Timer.State = 'idle';
  const moves = MoveBuffer.make<SmartCubeMoveEvent>();
  const setTimerValue = (milliseconds: number) => options.setTimer(Time.format(milliseconds));
  const localTimer = createLocalTimer(setTimerValue);

  function applyEffect(effect: Timer.Effect): void {
    if (typeof effect === 'string') {
      switch (effect) {
        case 'showTimer': options.showTimer(true); break;
        case 'hideTimer': options.showTimer(false); break;
        case 'startLocalTimer': localTimer.start(); break;
        case 'stopLocalTimer': localTimer.stop(); break;
        case 'clearSolutionMoves': MoveBuffer.clearSolution(moves); break;
        case 'showFinalTime': {
          const solutionMoves = MoveBuffer.solutionMoves(moves);
          if (solutionMoves.length > 0 && solutionMoves.every(move => move.cubeTimestamp !== null)) {
            const fitted = SmartCubeBindings.cubeTimestampLinearFit(solutionMoves);
            setTimerValue(fitted.at(-1)?.cubeTimestamp ?? 0);
          }
          break;
        }
      }
      return;
    }
    switch (effect.kind) {
      case 'setPhase': options.setTimerColor(PHASE_COLOR[effect.phase]); break;
      case 'setValueMs': setTimerValue(effect.ms); break;
    }
  }

  function dispatch(input: Timer.Input): void {
    const [next, effects] = Timer.step(state, input, options.isConnected());
    state = next;
    effects.forEach(applyEffect);
  }

  function onMove(move: SmartCubeMoveEvent): void {
    dispatch('moveDetected');
    if (move.cubeTimestamp === null) {
      options.setSkew('- n/a - (cube clock unavailable)');
    } else {
      MoveBuffer.pushRecent(moves, move);
    }
    if (state === 'running') MoveBuffer.pushSolution(moves, move);
    if (MoveBuffer.recentReady(moves)) {
      options.setSkew(`${SmartCubeBindings.cubeTimestampCalcSkew(MoveBuffer.recentMoves(moves))}%`);
    }
  }

  function reset(): void {
    MoveBuffer.reset(moves);
    dispatch('disconnected');
  }

  return { dispatch, onMove, reset };
}

export type TimerController = ReturnType<typeof createTimerController>;
