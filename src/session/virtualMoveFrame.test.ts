import { describe, expect, it } from 'vitest';

import { createVirtualMoveFrame } from './virtualMoveFrame';

describe('virtual move frame', () => {
  it('translates fixed physical faces into the accumulated virtual frame', () => {
    const frame = createVirtualMoveFrame();
    const displayed: string[] = [];
    const recordMove = (move: string) => displayed.push(frame.translate(move));
    const recordRegrip = (move: string) => {
      displayed.push(move);
      frame.applyRegrip(move);
    };

    recordMove("R'");
    recordRegrip("y'");
    recordMove("F'");
    recordRegrip("y'");
    recordMove("L'");
    recordMove("L'");
    recordRegrip("y'");
    recordMove("B'");

    expect(displayed).toEqual(["R'", "y'", "R'", "y'", "R'", "R'", "y'", "R'"]);
  });

  it('does not alter non-face tokens and resets on gyro recentering', () => {
    const frame = createVirtualMoveFrame();
    frame.applyRegrip('x');
    expect(frame.translate('U2')).not.toBe('U2');
    expect(frame.translate('M')).toBe('M');
    frame.reset();
    expect(frame.translate('U2')).toBe('U2');
  });
});
