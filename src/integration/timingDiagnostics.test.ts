import { describe, expect, it, vi } from 'vitest';

import { createTimingDiagnostics } from './timingDiagnostics';

function move(index: number, cubeTimestamp: number | null = index * 100) {
  return {
    type: 'MOVE' as const,
    timestamp: index * 101,
    localTimestamp: index * 101,
    cubeTimestamp,
    face: 0,
    direction: 0,
    move: 'U',
  };
}

describe('timing diagnostics', () => {
  it('reports an unavailable cube clock independently of solve timing', () => {
    const setSkew = vi.fn();
    const diagnostics = createTimingDiagnostics({ setSkew });

    diagnostics.onMove(move(1, null));

    expect(setSkew).toHaveBeenCalledWith('- n/a - (cube clock unavailable)');
  });

  it('waits for a useful sample window and clears it on reset', () => {
    const setSkew = vi.fn();
    const diagnostics = createTimingDiagnostics({ setSkew });

    for (let index = 1; index <= 10; index += 1) diagnostics.onMove(move(index));
    expect(setSkew).not.toHaveBeenCalled();

    diagnostics.onMove(move(11));
    expect(setSkew).toHaveBeenCalledWith(expect.stringMatching(/%$/));

    setSkew.mockClear();
    diagnostics.reset();
    diagnostics.onMove(move(12));
    expect(setSkew).not.toHaveBeenCalled();
  });
});
