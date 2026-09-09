import type { Quaternion } from './Quaternion.res.mjs';
import type { Axis, RegripToken } from './CubeNotation.res.mjs';

/** Independent virtual x/y/z regrip detector over calibrated gyro poses. */
export type RegripDetectorState = unknown;
export type RegripDetectorConfig = { thresholdDeg: number };
export type RegripAxis = Axis;
export type { RegripToken };
export type RegripObservation = {
  /** Raw positive/negative sensor-frame axis label. */
  sensorFrameToken: RegripToken;
  /** Clockwise Singmaster x/y/z label. */
  notationToken: RegripToken;
};

export const defaults: RegripDetectorConfig;
export const initial: RegripDetectorState;
export function step(
  state: RegripDetectorState,
  orientation: Quaternion,
  config?: RegripDetectorConfig,
): [RegripDetectorState, RegripObservation | undefined];
export function faceOrderForSensor(token: RegripToken): string;
export function faceOrderForNotation(token: RegripToken): string;
export function permuteFaceOrder(order: string, permutation: string): string;
