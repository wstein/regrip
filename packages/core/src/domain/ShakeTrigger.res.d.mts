import type { t as Quaternion } from './Quaternion.gen.js';

/** Opaque reducer state for the shake trigger. */
export type ShakeTriggerState = unknown;

export type ShakeTriggerConfig = {
  minStepAngleDeg: number;
  minSteps: number;
  minReversals: number;
  maxSampleGapMs: number;
  burstWindowMs: number;
  faceGuardMs: number;
  cooldownMs: number;
};

/** One detected shake. `at` is the time of the final reversal-bearing sample (ms). */
export type ShakeDetection = {
  at: number;
  steps: number;
  reversals: number;
  spanMs: number;
};

export const defaults: ShakeTriggerConfig;
export const initial: ShakeTriggerState;
/** Feed one calibrated orientation sample at time `at` (ms); usually returns undefined. */
export function observe(
  state: ShakeTriggerState,
  at: number,
  orientation: Quaternion,
  config?: ShakeTriggerConfig,
): [ShakeTriggerState, ShakeDetection | undefined];
/** Record a face turn at time `at` (ms); it rules out a nearby shake candidate. */
export function observeMove(
  state: ShakeTriggerState,
  at: number,
  config?: ShakeTriggerConfig,
): ShakeTriggerState;
