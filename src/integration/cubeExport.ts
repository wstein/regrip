import type { SmartCubeCubieState } from 'smartcube-web-bluetooth';

import * as CubeFacelets from '@wstein/regrip-core/domain/CubeFacelets';
import { formatSingmasterCycles, formatSupersetEngPermutation } from './cubeInfo';

export type CubeExportFormat =
  | 'compact-facelets'
  | 'spaced-facelets'
  | 'color-facelets'
  | 'singmaster-cycles'
  | 'sse-permutation'
  | 'cubie-coordinates'
  | 'kpattern-json'
  | 'regrip-state-json'
  | 'orbit64';
export type CubeExportSource = { facelets: string; state?: SmartCubeCubieState };

const base64url = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const faceletColors: Readonly<Record<string, string>> = {
  U: 'W',
  R: 'R',
  F: 'G',
  D: 'Y',
  L: 'O',
  B: 'B',
};

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
      if (permutation[later] < permutation[index]) smaller += 1;
    }
    rank = rank * BigInt(permutation.length - index) + BigInt(smaller);
  }
  return rank;
}

function parity(permutation: number[]): number {
  let inversions = 0;
  for (let index = 0; index < permutation.length; index += 1) {
    for (let later = index + 1; later < permutation.length; later += 1) {
      if (permutation[index] > permutation[later]) inversions += 1;
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
    result = `${base64url[Number(remaining % 64n)]}${result}`;
    remaining /= 64n;
  }
  return result;
}

/** Canonical-frame Orbit64 3×3×3 token from smartcube CP/CO/EP/EO data. */
export function formatOrbit64(state: SmartCubeCubieState): string | undefined {
  if (!validPermutation(state.CP, 8) || !validPermutation(state.EP, 12)) return undefined;
  const cornerOrientation = orientationRank(state.CO, 7, 3);
  const edgeOrientation = orientationRank(state.EO, 11, 2);
  if (cornerOrientation === undefined || edgeOrientation === undefined) return undefined;
  if (parity(state.CP) !== parity(state.EP)) return undefined;

  const cornerRank = permutationRank(state.CP) * 2187n + cornerOrientation;
  const edgeRank = permutationRankWithParity(state.EP) * 2048n + edgeOrientation;
  const midgeRadix = (factorial(12) / 2n) * 2048n;
  // Orbit64 stores a 24-way whole-cube frame after the coordinate rank. Copy
  // exports use the normalized Kociemba URFDLB body frame.
  return toBase64url((cornerRank * midgeRadix + edgeRank) * 24n, 12);
}

/** Copy-ready raw cubie coordinates in Kociemba / smart-cube order. */
export function formatCubieCoordinates(state: SmartCubeCubieState): string {
  return `CP: ${state.CP.join(',')}\nCO: ${state.CO.join(',')}\nEP: ${state.EP.join(',')}\nEO: ${state.EO.join(',')}`;
}

/** Sticker colors in canonical URFDLB face order, grouped by face. */
export function formatColorFacelets(facelets: string): string | undefined {
  if (facelets.length !== 54) return undefined;
  const colors = Array.from(facelets, (facelet) => faceletColors[facelet]);
  if (colors.some((color) => color === undefined)) return undefined;
  return colors.join('').match(/.{9}/g)?.join(' ');
}

/** cubing.js-compatible KPatternData serialized with stable indentation. */
export function formatKPatternJson(facelets: string): string | undefined {
  try {
    return JSON.stringify(CubeFacelets.faceletsToPatternData(facelets), null, 2);
  } catch {
    return undefined;
  }
}

/** Versioned Regrip state document in the normalized Kociemba body frame. */
export function formatRegripStateJson(source: CubeExportSource): string | undefined {
  if (!source.state) return undefined;
  return JSON.stringify(
    {
      format: 'regrip-state',
      version: 1,
      puzzle: '3x3x3',
      faceletOrder: 'URFDLB',
      facelets: source.facelets,
      cubies: {
        CP: source.state.CP,
        CO: source.state.CO,
        EP: source.state.EP,
        EO: source.state.EO,
      },
    },
    null,
    2,
  );
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
    case 'color-facelets':
      return formatColorFacelets(source.facelets);
    case 'singmaster-cycles':
      return source.state ? formatSingmasterCycles(source.state) : undefined;
    case 'sse-permutation':
      return source.state ? formatSupersetEngPermutation(source.state) : undefined;
    case 'cubie-coordinates':
      return source.state ? formatCubieCoordinates(source.state) : undefined;
    case 'kpattern-json':
      return formatKPatternJson(source.facelets);
    case 'regrip-state-json':
      return formatRegripStateJson(source);
    case 'orbit64':
      return source.state ? formatOrbit64(source.state) : undefined;
  }
}
