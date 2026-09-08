// Hand-written types for the compiled ReScript module src/GyroOrientation.res.

import type { Quaternion } from './Quaternion.res.mjs';

export type GyroOrientation = { basis: Quaternion | undefined };

export const home: Quaternion;
export function make(): GyroOrientation;
export function resetBasis(t: GyroOrientation): void;
/** `raw` is the cube's reported quaternion; returns the scene orientation. */
export function update(t: GyroOrientation, raw: Quaternion): Quaternion;
