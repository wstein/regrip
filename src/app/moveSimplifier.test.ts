import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';

import {
  formatDetectedMoves,
  formatSseMoves,
  parseDetectedMoves,
  simplifyMoves,
} from './moveSimplifier';

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
    ['M M', 'M2'],
    ["E E'", ''],
    ['S S S', "S'"],
    ["y M y'", 'S'],
    ["y S y'", "M'"],
    ["x E x'", "S'"],
    ["y y' z z z", "z'"],
    ['R U U R', 'R U2 R'],
    ['R unknown R R', 'R unknown R2'],
    ['x z2 x2', 'x y2'],
    ["x U x'", 'F'],
    ["y R y'", 'B'],
    ["z U z'", 'L'],
    ["y Rw y'", 'Bw'],
  ])('simplifies %j to %j', (input, expected) => {
    expect(simplifyMoves(input)).toBe(expected);
  });

  it('preserves cube state while normalizing a detected regrip stream', async () => {
    const input =
      "y R y R Rw' y R2 x' R' L' y Lw Rw' y Lw U R' y' z' y L' y' L z y' Uw x' z Rw x z2 x2";
    const simplified = simplifyMoves(input);
    const kpuzzle = await cube3x3x3.kpuzzle();

    expect(
      kpuzzle
        .algToTransformation(new Alg(simplified))
        .isIdentical(kpuzzle.algToTransformation(new Alg(input))),
    ).toBe(true);
    expect(simplified).toMatch(/(?:^| )x2 z'(?:$| )/);
    expect(simplified).not.toContain('x z2 x2');
  });

  it('preserves cube state while reframing middle slices', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const input of ["y M y'", "y S y'", "x E x'"]) {
      const simplified = simplifyMoves(input);
      expect(
        kpuzzle
          .algToTransformation(new Alg(simplified))
          .isIdentical(kpuzzle.algToTransformation(new Alg(input))),
      ).toBe(true);
    }
  });
});

describe('formatSseMoves', () => {
  it('converts regrips and wide turns to Superset ENG forms', () => {
    expect(formatSseMoves("R Rw U2 Lw' M E' S2 x y' z2")).toBe("R TR U2 TL' ML MD' MF2 CR CU' CF2");
  });

  it('combines opposing outer turns into Superset ENG slice twists', () => {
    expect(formatSseMoves("U' D B F' D U' L' R F' B")).toBe("SU' SB SD SL' SF'");
  });

  it('preserves the cube transformation when combining SSE slice twists', async () => {
    const input = "U' D B F' D U' L' R F' B";
    const expanded = formatSseMoves(input)
      .replaceAll("SU'", "U' D")
      .replaceAll('SB', "B F'")
      .replaceAll('SD', "D U'")
      .replaceAll("SL'", "L' R")
      .replaceAll("SF'", "F' B");
    const kpuzzle = await cube3x3x3.kpuzzle();
    expect(
      kpuzzle
        .algToTransformation(new Alg(expanded))
        .isIdentical(kpuzzle.algToTransformation(new Alg(input))),
    ).toBe(true);
  });

  it('leaves already-compatible and unrecognized tokens intact', () => {
    expect(formatSseMoves("R' unknown F2")).toBe("R' unknown F2");
  });
});

describe('detected-move notation views', () => {
  it('uses native SiGN spellings for the Twizzle view', () => {
    expect(formatDetectedMoves("Rw U Lw' M E' S2 x", 'twizzle')).toBe("r U l' 2L 2D' 2F2 Rv");
    expect(parseDetectedMoves("r U l' 2L 2D' 2F2 Rv", 'twizzle')).toBe("Rw U Lw' M E' S2 x");
  });

  it('round-trips SSE regrips, tiers, middle layers, and opposing slices', () => {
    const canonical = "U' D B F' M E' S2 x y' z2 Rw";
    const sse = formatDetectedMoves(canonical, 'sse');
    expect(sse).toBe("SU' SB ML MD' MF2 CR CU' CF2 TR");
    expect(parseDetectedMoves(sse, 'sse')).toBe(canonical);
  });
});
