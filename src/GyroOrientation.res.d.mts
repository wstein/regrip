// Hand-written types for the compiled ReScript module src/GyroOrientation.res.

import type { Quaternion } from './Quaternion.res.mjs';

export type GyroOrientation = { basis: Quaternion | undefined };

export const home: Quaternion;
export function make(): GyroOrientation;
export function resetBasis(t: GyroOrientation): void;
/** Raw cube quaternion components (qx, qy, qz, qw); returns the scene orientation. */
export function update(
  t: GyroOrientation,
  x: number,
  y: number,
  z: number,
  w: number,
): Quaternion;
