import * as CubeFacelets from '@wstein/regrip-core/domain/CubeFacelets';
import type { SmartCubeSessionEvent } from '@wstein/regrip-core/session/smartCubeSession';

export type SolveAnalysisSnapshot = {
  status: 'empty' | 'running' | 'complete';
  durationMs: number;
  tps: number | null;
  moveCount: number;
  qtm: number;
  regrips: number;
  triggers: number;
  longestPauseMs: number;
};

const emptySnapshot = (): SolveAnalysisSnapshot => ({
  status: 'empty',
  durationMs: 0,
  tps: null,
  moveCount: 0,
  qtm: 0,
  regrips: 0,
  triggers: 0,
  longestPauseMs: 0,
});

function quarterTurns(move: string): number {
  return /2'?$/.test(move.trim()) ? 2 : 1;
}

/** Summarize the current connection/replay run from its first physical turn. */
export function createSolveAnalysis(onChange?: (snapshot: SolveAnalysisSnapshot) => void) {
  let value = emptySnapshot();
  let startedAt: number | undefined;
  let lastMoveAt: number | undefined;

  const publish = (): void => onChange?.({ ...value });

  function reset(): void {
    value = emptySnapshot();
    startedAt = undefined;
    lastMoveAt = undefined;
    publish();
  }

  function onMove(event: Extract<SmartCubeSessionEvent, { type: 'MOVE' }>): void {
    if (value.status === 'complete') reset();
    startedAt ??= event.timestamp;
    const pause = lastMoveAt === undefined ? 0 : Math.max(0, event.timestamp - lastMoveAt);
    lastMoveAt = event.timestamp;
    value = {
      ...value,
      status: 'running',
      durationMs: Math.max(0, event.timestamp - startedAt),
      moveCount: value.moveCount + 1,
      qtm: value.qtm + quarterTurns(event.move),
      longestPauseMs: Math.max(value.longestPauseMs, pause),
    };
    publish();
  }

  function complete(): void {
    if (value.status !== 'running' || startedAt === undefined || lastMoveAt === undefined) return;
    const durationMs = Math.max(0, lastMoveAt - startedAt);
    value = {
      ...value,
      status: 'complete',
      durationMs,
      tps: durationMs > 0 ? value.moveCount / (durationMs / 1000) : null,
    };
    publish();
  }

  function onEvent(event: SmartCubeSessionEvent): void {
    switch (event.type) {
      case 'MOVE':
        onMove(event);
        break;
      case 'REGRIP':
        if (value.status === 'running') {
          value = { ...value, regrips: value.regrips + 1 };
          publish();
        }
        break;
      case 'CUSTOM_TRIGGER':
      case 'SHAKE':
        if (value.status === 'running') {
          value = { ...value, triggers: value.triggers + 1 };
          publish();
        }
        break;
      case 'FACELETS':
        if (CubeFacelets.isSolvedFacelets(event.facelets)) complete();
        break;
    }
  }

  return {
    onEvent,
    complete,
    reset,
    snapshot: (): SolveAnalysisSnapshot => ({ ...value }),
  };
}

export type SolveAnalysis = ReturnType<typeof createSolveAnalysis>;
