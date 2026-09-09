import { describe, expect, it } from 'vitest';
import { parseSensorToBodyAxisMap } from './axisMap';

describe('profile gyro axis map', () => {
  it('parses the bundled x,z,-y,w convention', () =>
    expect(parseSensorToBodyAxisMap('x,z,-y,w')).toEqual({
      x: { axis: 'X', sign: 1 },
      y: { axis: 'Z', sign: 1 },
      z: { axis: 'Y', sign: -1 },
    }));
  it.each(['x,z,-y', 'x,x,z,w', 'x,z,-y,q'])('rejects invalid map %s', (value) =>
    expect(parseSensorToBodyAxisMap(value)).toBeUndefined(),
  );
});
