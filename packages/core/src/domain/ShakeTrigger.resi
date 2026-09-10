// Detects a shake gesture from calibrated orientation telemetry. Ported from
// cubetrace's `ShakeDetector`; input is a calibrated relative pose, not raw wire
// values, so there is no norm-plausibility gate.

type config = {
  minStepAngleDeg: float,
  minSteps: int,
  minReversals: int,
  maxSampleGapMs: float,
  burstWindowMs: float,
  faceGuardMs: float,
  cooldownMs: float,
}

/** One detected shake. `at` is the time of the final reversal-bearing sample. */
type detection = {at: float, steps: int, reversals: int, spanMs: float}

type state

let defaults: config
let initial: state
/** Feed one calibrated orientation sample at time `at` (ms); usually returns `None`. */
let observe: (state, float, Quaternion.t, ~config: config=?) => (state, option<detection>)
/** Record a face turn at time `at` (ms); it rules out a nearby shake candidate. */
let observeMove: (state, float, ~config: config=?) => state
