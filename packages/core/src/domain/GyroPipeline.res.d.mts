import type { OrientationStabilizerConfig } from './OrientationStabilizer.res.mjs';
import type { t as Quaternion } from './Quaternion.gen.js';
import type { t as SensorToBody } from './SensorToBody.gen.js';

export type GyroVelocity = { x: number; y: number; z: number };
export type GyroSample = {
  relative: Quaternion;
  stabilized: Quaternion;
  velocityMagnitude: number;
  dtSeconds: number;
};
export type GyroPipelineConfig = unknown;
export type GyroPipelineState = unknown;

export function makeConfig(config: OrientationStabilizerConfig): GyroPipelineConfig;
export const initial: GyroPipelineState;
export function reset(state: GyroPipelineState): GyroPipelineState;
/** Preserve calibration/timing while discarding a stale stabilizer lock. */
export function resetStabilizer(state: GyroPipelineState): GyroPipelineState;
export function withStabilizerConfig(
  config: GyroPipelineConfig,
  stabilizer: OrientationStabilizerConfig,
): GyroPipelineConfig;
export function withSensorToBody(
  config: GyroPipelineConfig,
  sensorToBody: SensorToBody,
): GyroPipelineConfig;
export function step(
  state: GyroPipelineState,
  raw: Quaternion,
  timestamp: number,
  velocity: GyroVelocity | undefined,
  config: GyroPipelineConfig,
  stabilizerEnabled: boolean,
): [GyroPipelineState, GyroSample];
