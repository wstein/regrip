import { describe, expect, it } from 'vitest';

import * as CubeFacelets from '../domain/CubeFacelets.res.mjs';
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

  it('composes mixed local-axis regrips in physical order', () => {
    const frame = createVirtualMoveFrame();
    frame.applyRegrip('x');
    frame.applyRegrip('x');
    frame.applyRegrip('x');
    frame.applyRegrip("y'");

    // Regression from GoCube capture: after x x x y', a physical F is still
    // the user's right face. Reversing the composition order returned D.
    expect(frame.translate('F')).toBe('R');
    expect(frame.translate("F'")).toBe("R'");
  });

  it('exposes logical R/U/F directions after virtual regrips', () => {
    const frame = createVirtualMoveFrame();
    expect(frame.orientation()).toEqual({
      right: [1, 0, 0],
      up: [0, 1, 0],
      front: [0, 0, 1],
      faces: { right: 'R', up: 'U', front: 'F' },
    });

    frame.applyRegrip('y');
    // After logical y, the physical B/U/R faces occupy logical R/U/F.
    expect(frame.orientation()).toEqual({
      right: [0, 0, -1],
      up: [0, 1, 0],
      front: [1, 0, 0],
      faces: { right: 'B', up: 'U', front: 'R' },
    });
  });

  it('reframes all 54 facelets, including face-grid orientation and centre colours', () => {
    const solved =
      'U'.repeat(9) + 'R'.repeat(9) + 'F'.repeat(9) + 'D'.repeat(9) + 'L'.repeat(9) + 'B'.repeat(9);
    const frame = createVirtualMoveFrame();
    frame.applyRegrip('y');

    // A regripped solved cube remains solved in its logical URFDLB frame.
    expect(frame.reframeFacelets(solved)).toBe(solved);

    const markedFaces =
      'u'.repeat(9) + 'r'.repeat(9) + 'f'.repeat(9) + 'd'.repeat(9) + 'l'.repeat(9) + 'b'.repeat(9);
    expect(frame.reframeFacelets(markedFaces).slice(4, 5)).toBe('u');
    expect(frame.reframeFacelets(markedFaces).slice(13, 14)).toBe('b');
  });

  it('returns an arbitrary facelet state after four quarter regrips', () => {
    const facelets = Array.from({ length: 54 }, (_, index) =>
      String.fromCharCode(33 + index + (33 + index >= 66 ? 6 : 0)),
    ).join('');
    const once = createVirtualMoveFrame();
    once.applyRegrip('y');
    expect(new Set(once.reframeFacelets(facelets))).toHaveLength(54);

    const frame = createVirtualMoveFrame();
    ['y', 'y', 'y', 'y'].forEach((token) => frame.applyRegrip(token));
    expect(frame.reframeFacelets(facelets)).toBe(facelets);
  });

  it('keeps a legal scrambled state legal after mixed regrips', () => {
    const scrambled = 'FBFRULDLFUBUURDBDBFFRLFFLURDBDUDFURLDBRLLURRBLDLRBDUFB';
    const frame = createVirtualMoveFrame();
    ['x', "y'", 'z', 'x'].forEach((token) => frame.applyRegrip(token));

    expect(() =>
      CubeFacelets.faceletsToPatternData(frame.reframeFacelets(scrambled)),
    ).not.toThrow();
  });
});
