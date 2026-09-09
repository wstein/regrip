import type { OrientationStabilizerConfig } from './OrientationStabilizer.res.mjs';
import type { Quaternion } from './Quaternion.res.mjs';

export type GyroVelocity = { x: number; y: number; z: number };
export type GyroSample = {
  relative: Quaternion;
  stabilized: Quaternion;
  velocityMagnitude: number;
  dtSeconds: number;
};
export type GyroPipeline = unknown;

export function make(config: OrientationStabilizerConfig): GyroPipeline;
export function reset(pipeline: GyroPipeline): void;
export function setStabilizerConfig(
  pipeline: GyroPipeline,
  config: OrientationStabilizerConfig,
): void;
export function update(
  pipeline: GyroPipeline,
  raw: Quaternion,
  timestamp: number,
  velocity: GyroVelocity | undefined,
  stabilizerEnabled: boolean,
): GyroSample;
