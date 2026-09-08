import type { Quaternion } from './Quaternion.res.mjs';

export type OrientationStabilizerConfig = {
  radiusDeg: number;
  snapDeg: number;
  hysteresisDeg: number;
  velocityMax: number;
};

export type OrientationStabilizer = unknown;

export const defaults: OrientationStabilizerConfig;
export function make(config?: OrientationStabilizerConfig): OrientationStabilizer;
export function reset(stabilizer: OrientationStabilizer): void;
export function lockedPose(stabilizer: OrientationStabilizer): Quaternion | undefined;
export function update(stabilizer: OrientationStabilizer, raw: Quaternion, velocity?: number): Quaternion;
