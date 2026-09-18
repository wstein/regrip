import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';

import {
  formatDetectedMoves,
  formatSseMoves,
  parseDetectedMoves,
  simplifyMovesModuloRotations,
} from './moveSimplifier';

describe('simplifyMovesModuloRotations', () => {
  it('folds opposing outer turns into slices when simplifying the recorded frame', () => {
    expect(simplifyMovesModuloRotations("U U D' D'")).toBe('E2');
    expect(simplifyMovesModuloRotations("E2 M2 R L' R L'")).toBe('E2');
  });
});

describe('formatSseMoves', () => {
  it('converts regrips and wide turns to Superset ENG forms', () => {
    expect(formatSseMoves("R Rw U2 Lw' M E' S2 x y' z2")).toBe("R TR U2 TL' ML MD' MF2 CR CU' CF2");
  });

  it('renders live QTM turns without automatic SSE reductions', () => {
    expect(formatSseMoves("U' D B F' D U' L' R F' B")).toBe("U' D B F' D U' L' R F' B");
  });

  it('renders the shared simplification result in SSE', () => {
    const simplified = simplifyMovesModuloRotations("U U D' D'");
    expect(simplified).toBe('E2');
    expect(formatDetectedMoves(simplified, 'sse')).toBe('MD2');
  });

  it('leaves already-compatible and unrecognized tokens intact', () => {
    expect(formatSseMoves("R' unknown F2")).toBe("R' unknown F2");
  });
});

describe('detected-move notation views', () => {
  it('uses native SiGN spellings for the SiGN view', () => {
    expect(formatDetectedMoves("Rw U Lw' M E' S2 x", 'sign')).toBe("r U l' 2L 2D' 2F2 Rv");
    expect(parseDetectedMoves("r U l' 2L 2D' 2F2 Rv", 'sign')).toBe("Rw U Lw' M E' S2 x");
  });

  it('leaves raw QTM tokens unchanged', () => {
    expect(formatDetectedMoves("R U U'", 'raw-qtm')).toBe("R U U'");
    expect(parseDetectedMoves("R U U'", 'raw-qtm')).toBe("R U U'");
  });

  it('round-trips SSE regrips, tiers, middle layers, and opposing slices', () => {
    const canonical = "U' D B F' M E' S2 x y' z2 Rw";
    const sse = formatDetectedMoves(canonical, 'sse');
    expect(sse).toBe("U' D B F' ML MD' MF2 CR CU' CF2 TR");
    expect(parseDetectedMoves(sse, 'sse')).toBe(canonical);
  });

  it('expands Jaap aliases and repetition groups while retaining its formatter', () => {
    const jaap = "F2 R2 Ua' (R2 F2)2 Ua F2 R2";
    const canonical = "F2 R2 U' D' R2 F2 R2 F2 U D F2 R2";
    expect(parseDetectedMoves(jaap, 'jaap')).toBe(canonical);
    expect(formatDetectedMoves("M E' S2 x y' z2", 'jaap')).toBe("Lm Dm' Fm2 Rc Uc' Fc2");
  });

  it('expands wide moves into Jaap face turns plus regrips', async () => {
    const canonical = "Rw Lw' Uw Dw' Fw2 Bw2";
    const jaap = formatDetectedMoves(canonical, 'jaap');
    expect(jaap).toBe("L Rc R' Rc D Uc U' Uc B2 Fc2 F2 Fc2");
    const kpuzzle = await cube3x3x3.kpuzzle();
    expect(
      kpuzzle
        .algToTransformation(new Alg(parseDetectedMoves(jaap, 'jaap')))
        .isIdentical(kpuzzle.algToTransformation(new Alg(canonical))),
    ).toBe(true);
  });

  it('expands every SSE opposing-slice spelling', () => {
    expect(parseDetectedMoves("SU SU' SR2 SD SF' SB", 'sse')).toBe(
      "U D' U' D R2 L2 D U' F' B B F'",
    );
  });

  it('keeps malformed notation tokens visible', () => {
    expect(parseDetectedMoves('CX 2X q', 'sse')).toBe('CX 2X q');
    expect(simplifyMovesModuloRotations("D' U D' U")).toBe('E2');
  });
});
