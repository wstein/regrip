import { describe, expect, it } from 'vitest';

import { cubeTimestampCalcSkew, cubeTimestampLinearFit } from './Bindings_SmartCube.gen';

type TimestampedMove = {
  face: number;
  direction: number;
  move: string;
  localTimestamp: number;
  cubeTimestamp: number | null;
};

function move(localTimestamp: number, cubeTimestamp: number | null): TimestampedMove {
  return { face: 0, direction: 0, move: 'U', localTimestamp, cubeTimestamp };
}

describe('smart-cube timestamp bindings', () => {
  it('forwards skew calculation through the generated ReScript boundary', () => {
    expect(
      cubeTimestampCalcSkew([move(1_000, 1_020), move(2_000, 2_040), move(3_000, 3_060)]),
    ).toBe(2);
  });

  it('forwards timestamp fitting through the generated ReScript boundary', () => {
    const moves = [move(1_000, 200), move(1_100, 300)];

    expect(cubeTimestampLinearFit(moves).map(({ cubeTimestamp }) => cubeTimestamp)).toEqual([
      0, 100,
    ]);
  });
});
