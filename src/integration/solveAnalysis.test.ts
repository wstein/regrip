import { describe, expect, it } from 'vitest';

import { createSolveAnalysis } from './solveAnalysis';

const solved = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const move = (timestamp: number, notation = 'R') => ({
  type: 'MOVE' as const,
  timestamp,
  localTimestamp: timestamp,
  cubeTimestamp: timestamp,
  face: 0,
  direction: 0,
  move: notation,
});

describe('solve analysis', () => {
  it('measures physical turns, QTM, gestures, TPS, and the longest move pause', () => {
    const analysis = createSolveAnalysis();

    analysis.onEvent(move(1_000, 'R'));
    analysis.onEvent({
      type: 'REGRIP',
      timestamp: 1_150,
      notationToken: 'x',
      sensorFrameToken: 'x',
    });
    analysis.onEvent(move(1_400, 'U2'));
    analysis.onEvent({ type: 'CUSTOM_TRIGGER', timestamp: 1_450, move: "R U R'" });
    analysis.onEvent({ type: 'SHAKE', timestamp: 1_500, steps: 4, reversals: 3, spanMs: 200 });
    analysis.onEvent(move(2_200, "F'"));
    analysis.onEvent({ type: 'FACELETS', timestamp: 2_210, facelets: solved });

    expect(analysis.snapshot()).toEqual({
      status: 'complete',
      durationMs: 1_200,
      tps: 2.5,
      moveCount: 3,
      qtm: 4,
      regrips: 1,
      triggers: 2,
      longestPauseMs: 800,
    });
  });

  it('resets a completed result when the next physical turn starts', () => {
    const analysis = createSolveAnalysis();
    analysis.onEvent(move(100));
    analysis.onEvent(move(200));
    analysis.onEvent({ type: 'FACELETS', timestamp: 210, facelets: solved });

    analysis.onEvent(move(500, 'L2'));

    expect(analysis.snapshot()).toEqual({
      status: 'running',
      durationMs: 0,
      tps: null,
      moveCount: 1,
      qtm: 2,
      regrips: 0,
      triggers: 0,
      longestPauseMs: 0,
    });
  });

  it('returns to an empty result when reset', () => {
    const analysis = createSolveAnalysis();
    analysis.onEvent(move(100));

    analysis.reset();

    expect(analysis.snapshot().status).toBe('empty');
    expect(analysis.snapshot().moveCount).toBe(0);
  });
});
