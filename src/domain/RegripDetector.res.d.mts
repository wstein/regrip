import type { Quaternion } from './Quaternion.res.mjs';

/** Independent virtual x/y/z regrip detector over calibrated gyro poses. */
export type RegripDetector = unknown;
export type RegripDetectorConfig = { thresholdDeg: number };
export type RegripAxis = 'x' | 'y' | 'z';
export type RegripToken = 'x' | "x'" | 'y' | "y'" | 'z' | "z'";
export type RegripObservation = {
  /** Raw positive/negative sensor-frame axis label. */
  sensorFrameToken: RegripToken;
  /** Clockwise Singmaster x/y/z label. */
  notationToken: RegripToken;
};

export const defaults: RegripDetectorConfig;
export function make(config?: RegripDetectorConfig): RegripDetector;
export function reset(detector: RegripDetector): void;
export function observe(detector: RegripDetector, orientation: Quaternion): RegripObservation | undefined;
export function faceOrderForSensor(token: string): string;
export function faceOrderForNotation(token: string): string;
export function permuteFaceOrder(order: string, permutation: string): string;
