// Pure, renderer-independent orientation magnet. The caller owns reducer state.

type config = {
  radiusDeg: float,
  snapDeg: float,
  hysteresisDeg: float,
  velocityMax: float,
  driftDegPerSec: float,
}

let defaults = {
  radiusDeg: MagneticDetent.defaults.radiusDeg,
  snapDeg: MagneticDetent.defaults.snapDeg,
  hysteresisDeg: 5.,
  velocityMax: MagneticDetent.defaults.velocityMax,
  driftDegPerSec: 2.,
}

type state = {lockedPose: option<Quaternion.t>, driftOffset: Quaternion.t}
type sample = {driftCorrected: Quaternion.t, stabilized: Quaternion.t}
let initial: state = {lockedPose: None, driftOffset: Quaternion.identity}

let reset = (_: state): state => initial
let lockedPose = (state: state): option<Quaternion.t> => state.lockedPose

let detentConfig = (config: config): MagneticDetent.config => {
  radiusDeg: config.radiusDeg,
  snapDeg: config.snapDeg,
  velocityMax: config.velocityMax,
}

let stepSample = (state: state, raw: Quaternion.t, ~velocity=0., ~dtSeconds=0., ~config=defaults): (
  state,
  sample,
) => {
  let corrected = Quaternion.multiply(state.driftOffset, raw)
  let target = CubeSymmetry.nearest(
    corrected,
    state.lockedPose,
    Quaternion.degreesToRadians(config.hysteresisDeg),
  )
  let velocityGate = 1. -. Math.min(1., Math.abs(velocity) /. config.velocityMax)
  let maximumStep = Quaternion.degreesToRadians(config.driftDegPerSec) *. dtSeconds *. velocityGate
  let driftOffset = if maximumStep > 0. {
    let difference = Quaternion.multiply(target, Quaternion.conjugate(corrected))
    let differenceAngle = Quaternion.angle(corrected, target)
    if differenceAngle > 0. {
      let fraction = Math.min(1., maximumStep /. differenceAngle)
      Quaternion.multiply(
        Quaternion.slerp(Quaternion.identity, difference, fraction),
        state.driftOffset,
      )
    } else {
      state.driftOffset
    }
  } else {
    state.driftOffset
  }
  let adjusted = Quaternion.multiply(driftOffset, raw)
  (
    {lockedPose: Some(target), driftOffset},
    {
      driftCorrected: adjusted,
      stabilized: MagneticDetent.apply(adjusted, target, ~velocity, ~config=detentConfig(config)),
    },
  )
}

let step = (state: state, raw: Quaternion.t, ~velocity=0., ~dtSeconds=0., ~config=defaults): (
  state,
  Quaternion.t,
) => {
  let (state, sample) = stepSample(state, raw, ~velocity, ~dtSeconds, ~config)
  (state, sample.stabilized)
}
