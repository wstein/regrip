import type { t as Quaternion } from './Quaternion.gen.js';

export type OrientationStabilizerConfig = {
  radiusDeg: number;
  snapDeg: number;
  hysteresisDeg: number;
  velocityMax: number;
  /** Maximum resting drift correction, in degrees per second. */
  driftDegPerSec: number;
};
/** Opaque state for the orientation-stabilizer reducer. */
export type OrientationStabilizerState = unknown;

export const defaults: OrientationStabilizerConfig;
export const initial: OrientationStabilizerState;
export function reset(state: OrientationStabilizerState): OrientationStabilizerState;
export function lockedPose(state: OrientationStabilizerState): Quaternion | undefined;
export function step(
  state: OrientationStabilizerState,
  raw: Quaternion,
  velocity?: number,
  dtSeconds?: number,
  config?: OrientationStabilizerConfig,
): [OrientationStabilizerState, Quaternion];
