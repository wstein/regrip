import type { Quaternion } from './Quaternion.res.mjs';

export type OrientationStabilizerConfig = {
  radiusDeg: number;
  snapDeg: number;
  hysteresisDeg: number;
  velocityMax: number;
  /** Maximum resting drift correction, in degrees per second. */
  driftDegPerSec: number;
};

export type OrientationStabilizer = unknown;

export const defaults: OrientationStabilizerConfig;
export function make(config?: OrientationStabilizerConfig): OrientationStabilizer;
export function reset(stabilizer: OrientationStabilizer): void;
/** Reconfiguration starts a fresh lock so profiles cannot retain a stale pose. */
export function setConfig(stabilizer: OrientationStabilizer, config: OrientationStabilizerConfig): void;
export function lockedPose(stabilizer: OrientationStabilizer): Quaternion | undefined;
export function update(stabilizer: OrientationStabilizer, raw: Quaternion, velocity?: number, dtSeconds?: number): Quaternion;
