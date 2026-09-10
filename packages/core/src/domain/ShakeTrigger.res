// Detects a shake gesture from calibrated orientation telemetry. A pure
// reducer: session code supplies the relative pose and face-turn timestamps.
//
// Ported from cubetrace's `ShakeDetector` (Apache-2.0, wstein/bluez-gatt-recorder):
// four rapid orientation steps with at least two direction reversals inside a
// short window make a candidate, which is held until a face-turn guard elapses
// and dropped if a face turn lands near it. That distinguishes a back-and-forth
// shake from one fast turn. The angle uses the absolute four-vector dot, so it
// does not depend on which wire slot carries the quaternion scalar.
//
// Unlike the source, the input is assumed to be a roughly-unit calibrated pose
// (the gyro pipeline already rejects malformed samples), so there is no
// norm-plausibility gate — the sample is normalised and used.

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

type sample = {at: float, pose: Quaternion.t}
type step = {at: float, direction: Quaternion.t}
type candidate = {at: float, steps: int, reversals: int, spanMs: float}

type state = {
  previous: option<sample>,
  rapidSteps: array<step>,
  pending: option<candidate>,
  lastMoveAt: option<float>,
  lastDetectionAt: option<float>,
}

let defaults = {
  minStepAngleDeg: 10.,
  minSteps: 4,
  minReversals: 2,
  maxSampleGapMs: 250.,
  burstWindowMs: 300.,
  faceGuardMs: 400.,
  cooldownMs: 500.,
}

let initial: state = {
  previous: None,
  rapidSteps: [],
  pending: None,
  lastMoveAt: None,
  lastDetectionAt: None,
}

let negate = (q: Quaternion.t): Quaternion.t => {x: -.q.x, y: -.q.y, z: -.q.z, w: -.q.w}

// Element-wise four-vector difference, reused only for its direction.
let difference = (a: Quaternion.t, b: Quaternion.t): Quaternion.t => {
  x: a.x -. b.x,
  y: a.y -. b.y,
  z: a.z -. b.z,
  w: a.w -. b.w,
}

let countReversals = (steps: array<step>): int =>
  steps->Array.reduceWithIndex(0, (total, step, index) =>
    if index == 0 {
      total
    } else if Quaternion.dot(Array.getUnsafe(steps, index - 1).direction, step.direction) < 0. {
      total + 1
    } else {
      total
    }
  )

let elapsedAtMost = (reference: option<float>, now: float, window: float): bool =>
  switch reference {
  | Some(mark) => now -. mark <= window
  | None => false
  }

let elapsedLessThan = (reference: option<float>, now: float, window: float): bool =>
  switch reference {
  | Some(mark) => now -. mark < window
  | None => false
  }

// Release a held candidate once its face-turn guard has elapsed with no turn.
let releaseMature = (state: state, now: float, config: config): (state, option<detection>) =>
  switch state.pending {
  | Some(candidate) if now -. candidate.at >= config.faceGuardMs => (
      {...state, pending: None, lastDetectionAt: Some(candidate.at)},
      Some({
        at: candidate.at,
        steps: candidate.steps,
        reversals: candidate.reversals,
        spanMs: candidate.spanMs,
      }),
    )
  | _ => (state, None)
  }

/**
 Feeds one calibrated orientation sample at time `at` (ms). A detection is
 returned only after its turn guard has elapsed; the usual result is `None`.
 */
let observe = (state: state, at: float, orientation: Quaternion.t, ~config=defaults): (
  state,
  option<detection>,
) => {
  let (state, released) = releaseMature(state, at, config)
  let normalized = Quaternion.normalize(orientation)

  switch state.previous {
  | None => ({...state, previous: Some({at, pose: normalized})}, released)
  | Some(before) => {
      // Keep successive samples on one hemisphere so a step is a real motion.
      let current = Quaternion.dot(before.pose, normalized) < 0. ? negate(normalized) : normalized
      let state = {...state, previous: Some({at, pose: current})}
      let interval = at -. before.at

      if (
        interval <= 0. ||
        interval > config.maxSampleGapMs ||
        Quaternion.angle(before.pose, current) < Quaternion.degreesToRadians(config.minStepAngleDeg)
      ) {
        // Not part of a rapid burst — start counting again from here.
        ({...state, rapidSteps: []}, released)
      } else {
        let rapidSteps =
          [
            ...state.rapidSteps,
            {at, direction: difference(current, before.pose)},
          ]->Array.filter(step => at -. step.at <= config.burstWindowMs)
        let reversals = countReversals(rapidSteps)
        let pending = switch state.pending {
        | Some(_) => state.pending
        | None =>
          Array.length(rapidSteps) >= config.minSteps &&
          reversals >= config.minReversals &&
          !elapsedAtMost(state.lastMoveAt, at, config.faceGuardMs) &&
          !elapsedLessThan(state.lastDetectionAt, at, config.cooldownMs)
            ? Some({
                at,
                steps: Array.length(rapidSteps),
                reversals,
                spanMs: at -. Array.getUnsafe(rapidSteps, 0).at,
              })
            : None
        }
        ({...state, rapidSteps, pending}, released)
      }
    }
  }
}

/** Records a face turn at time `at` (ms); it rules out a nearby shake candidate. */
let observeMove = (state: state, at: float, ~config=defaults): state => {
  let state = {...state, lastMoveAt: Some(at)}
  switch state.pending {
  | Some(candidate) if Math.abs(at -. candidate.at) <= config.faceGuardMs => {
      ...state,
      pending: None,
    }
  | _ => state
  }
}
