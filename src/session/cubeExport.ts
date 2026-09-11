import type { SmartCubeCubieState } from 'smartcube-web-bluetooth';

import { formatCubieState } from './cubeInfo';

export type CubeExportFormat =
  'compact-facelets' | 'spaced-facelets' | 'singmaster' | 'cubie-coordinates' | 'orbit64';
export type CubeExportSource = { facelets: string; state?: SmartCubeCubieState };

const base64url = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// `CubeFacelets` follows cubing.js's Reid order. Orbit64's canonical 3×3
// coordinates use `UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR` for edges
// and `URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB` for corners. Keep this
// conversion at the protocol boundary: the ranker itself only sees Orbit64
// coordinates.
const orbit64CornerSlots = [0, 3, 2, 1, 4, 5, 6, 7];
const orbit64CornerPieces = [0, 3, 2, 1, 4, 5, 6, 7];
const orbit64EdgeSlots = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10];
const orbit64EdgePieces = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10];

function toOrbit64Coordinates(
  pieces: number[],
  orientation: number[],
  slots: number[],
  pieceMap: number[],
): { pieces: number[]; orientation: number[] } {
  return {
    pieces: slots.map((slot) => pieceMap[pieces[slot]!]!),
    orientation: slots.map((slot) => orientation[slot]!),
  };
}

function validPermutation(values: number[], length: number): boolean {
  return (
    values.length === length &&
    values.every((value) => Number.isInteger(value) && value >= 0 && value < length) &&
    new Set(values).size === length
  );
}

function orientationRank(values: number[], count: number, radix: number): bigint | undefined {
  if (
    values.length !== count + 1 ||
    values.some((value) => !Number.isInteger(value) || value < 0 || value >= radix) ||
    values.reduce((sum, value) => sum + value, 0) % radix !== 0
  ) {
    return undefined;
  }
  return values
    .slice(0, count)
    .reduce((rank, value, index) => rank + BigInt(value) * BigInt(radix) ** BigInt(index), 0n);
}

function permutationRank(permutation: number[], count = permutation.length): bigint {
  let rank = 0n;
  for (let index = 0; index < count; index += 1) {
    let smaller = 0;
    for (let later = index + 1; later < permutation.length; later += 1) {
      if (permutation[later]! < permutation[index]!) smaller += 1;
    }
    rank = rank * BigInt(permutation.length - index) + BigInt(smaller);
  }
  return rank;
}

function parity(permutation: number[]): number {
  let inversions = 0;
  for (let index = 0; index < permutation.length; index += 1) {
    for (let later = index + 1; later < permutation.length; later += 1) {
      if (permutation[index]! > permutation[later]!) inversions += 1;
    }
  }
  return inversions % 2;
}

/** Orbit64's compact rank within one fixed permutation parity class. */
function permutationRankWithParity(permutation: number[]): bigint {
  return permutationRank(permutation, permutation.length - 2);
}

function factorial(value: number): bigint {
  let result = 1n;
  for (let factor = 2; factor <= value; factor += 1) result *= BigInt(factor);
  return result;
}

function toBase64url(value: bigint, width: number): string {
  let result = '';
  let remaining = value;
  for (let index = 0; index < width; index += 1) {
    result = `${base64url[Number(remaining % 64n)]!}${result}`;
    remaining /= 64n;
  }
  return result;
}

/** Canonical-frame Orbit64 3×3×3 token from smartcube CP/CO/EP/EO data. */
export function formatOrbit64(state: SmartCubeCubieState): string | undefined {
  if (!validPermutation(state.CP, 8) || !validPermutation(state.EP, 12)) return undefined;
  const corners = toOrbit64Coordinates(state.CP, state.CO, orbit64CornerSlots, orbit64CornerPieces);
  const edges = toOrbit64Coordinates(state.EP, state.EO, orbit64EdgeSlots, orbit64EdgePieces);
  const cornerOrientation = orientationRank(corners.orientation, 7, 3);
  const edgeOrientation = orientationRank(edges.orientation, 11, 2);
  if (cornerOrientation === undefined || edgeOrientation === undefined) return undefined;
  if (parity(corners.pieces) !== parity(edges.pieces)) return undefined;

  const cornerRank = permutationRank(corners.pieces) * 2187n + cornerOrientation;
  const edgeRank = permutationRankWithParity(edges.pieces) * 2048n + edgeOrientation;
  const midgeRadix = (factorial(12) / 2n) * 2048n;
  // Orbit64 stores a 24-way whole-cube frame after the coordinate rank. The
  // solver-reframed facelets and smartcube cubie state use canonical URFDLB.
  return toBase64url((cornerRank * midgeRadix + edgeRank) * 24n, 12);
}

/** Copy-ready raw cubie coordinates in smartcube / KPattern order. */
export function formatCubieCoordinates(state: SmartCubeCubieState): string {
  return `CP: ${state.CP.join(',')}\nCO: ${state.CO.join(',')}\nEP: ${state.EP.join(',')}\nEO: ${state.EO.join(',')}`;
}

export function formatCubeExport(
  source: CubeExportSource | undefined,
  format: CubeExportFormat,
): string | undefined {
  if (!source || source.facelets.length !== 54) return undefined;
  switch (format) {
    case 'compact-facelets':
      return source.facelets;
    case 'spaced-facelets':
      return source.facelets.match(/.{1,9}/g)?.join(' ');
    case 'singmaster':
      return source.state ? formatCubieState(source.state) : undefined;
    case 'cubie-coordinates':
      return source.state ? formatCubieCoordinates(source.state) : undefined;
    case 'orbit64':
      return source.state ? formatOrbit64(source.state) : undefined;
  }
}
