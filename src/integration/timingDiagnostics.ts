import type { SmartCubeMoveEvent } from 'smartcube-web-bluetooth';

import * as SmartCubeBindings from '@wstein/regrip-core/bindings/Bindings_SmartCube';
import * as MoveBuffer from '@wstein/regrip-core/domain/MoveBuffer';

type TimingDiagnosticsOptions = {
  setSkew: (value: string) => void;
};

/** Track transport-clock quality independently from solve and session timing. */
export function createTimingDiagnostics(options: TimingDiagnosticsOptions) {
  let moves = MoveBuffer.initial<SmartCubeMoveEvent>();

  function onMove(move: SmartCubeMoveEvent): void {
    if (move.cubeTimestamp === null) {
      options.setSkew('- n/a - (cube clock unavailable)');
      return;
    }
    moves = MoveBuffer.pushRecent(moves, move);
    if (MoveBuffer.recentReady(moves)) {
      options.setSkew(`${SmartCubeBindings.cubeTimestampCalcSkew(MoveBuffer.recentMoves(moves))}%`);
    }
  }

  function reset(): void {
    moves = MoveBuffer.reset(moves);
  }

  return { onMove, reset };
}

export type TimingDiagnostics = ReturnType<typeof createTimingDiagnostics>;
