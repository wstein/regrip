// Hand-written types for the compiled ReScript module src/GyroOrientation.res.

import type { Quaternion } from './Quaternion.res.mjs';

export type GyroOrientation = { basis: Quaternion | undefined };

export const home: Quaternion;
export function make(): GyroOrientation;
export function makeWithHome(home: Quaternion): GyroOrientation;
export function resetBasis(t: GyroOrientation): void;
/** `raw` normalized against the initial sample, before applying `home`. */
export function relative(t: GyroOrientation, raw: Quaternion): Quaternion;
/** Apply this tracker's configured resting pose to a relative orientation. */
export function applyHome(t: GyroOrientation, relative: Quaternion): Quaternion;
/** `raw` is the cube's reported quaternion; returns the scene orientation. */
export function update(t: GyroOrientation, raw: Quaternion): Quaternion;
