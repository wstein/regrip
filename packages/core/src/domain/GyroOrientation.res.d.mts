import type { t as Quaternion } from './Quaternion.gen.js';
import type { SensorToBody } from './SensorToBody.res.mjs';

/** Opaque calibration state for the gyro orientation reducer. */
export type GyroOrientationState = unknown;

export const home: Quaternion;
export const initial: GyroOrientationState;
export function reset(state: GyroOrientationState): GyroOrientationState;
export function relative(
  state: GyroOrientationState,
  raw: Quaternion,
  sensorToBody?: SensorToBody,
): [GyroOrientationState, Quaternion];
export function applyHome(relative: Quaternion, home?: Quaternion): Quaternion;
export function step(
  state: GyroOrientationState,
  raw: Quaternion,
  sensorToBody?: SensorToBody,
  home?: Quaternion,
): [GyroOrientationState, Quaternion];
