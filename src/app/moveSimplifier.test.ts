import { describe, expect, it } from 'vitest';

import { simplifyMoves } from './moveSimplifier';

describe('simplifyMoves', () => {
  it.each([
    ['R R', 'R2'],
    ['R R R', "R'"],
    ['R R R R', ''],
    ["R R'", ''],
    ['x x', 'x2'],
    ['L x', 'Rw'],
    ['L L x x', 'Rw2'],
    ["L' x'", "Rw'"],
    ["R x'", 'Lw'],
    ['D y', 'Uw'],
    ["U y'", 'Dw'],
    ['B z', 'Fw'],
    ["F z'", 'Bw'],
    ['Rw Rw', 'Rw2'],
    ["y y' z z z", "z'"],
    ['R U U R', 'R U2 R'],
    ['R unknown R R', 'R unknown R2'],
  ])('simplifies %j to %j', (input, expected) => {
    expect(simplifyMoves(input)).toBe(expected);
  });
});
