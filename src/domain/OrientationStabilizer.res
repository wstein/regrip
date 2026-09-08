// Stateful, renderer-independent orientation magnet. It owns only the lock;
// all quaternion math and detent behaviour remain independently testable.

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

type t = {
  mutable lockedPose: option<Quaternion.t>,
  mutable driftOffset: Quaternion.t,
  mutable config: config,
}

let make = (~config=defaults): t => {lockedPose: None, driftOffset: Quaternion.identity, config}

let reset = (t: t): unit => {
  t.lockedPose = None
  t.driftOffset = Quaternion.identity
}

let setConfig = (t: t, config: config): unit => {
  t.config = config
  reset(t)
}

let lockedPose = (t: t): option<Quaternion.t> => t.lockedPose

let detentConfig = (config: config): MagneticDetent.config => {
  radiusDeg: config.radiusDeg,
  snapDeg: config.snapDeg,
  velocityMax: config.velocityMax,
}

let update = (t: t, raw: Quaternion.t, ~velocity=0., ~dtSeconds=0.): Quaternion.t => {
  let corrected = Quaternion.multiply(t.driftOffset, raw)
  let target = CubeSymmetry.nearest(
    corrected,
    t.lockedPose,
    Quaternion.degreesToRadians(t.config.hysteresisDeg),
  )
  t.lockedPose = Some(target)
  let velocityGate = 1. -. Math.min(1., Math.abs(velocity) /. t.config.velocityMax)
  let maximumStep = Quaternion.degreesToRadians(t.config.driftDegPerSec) *. dtSeconds *. velocityGate
  if maximumStep > 0. {
    let difference = Quaternion.multiply(target, Quaternion.conjugate(corrected))
    let differenceAngle = Quaternion.angle(corrected, target)
    if differenceAngle > 0. {
      let fraction = Math.min(1., maximumStep /. differenceAngle)
      t.driftOffset = Quaternion.multiply(Quaternion.slerp(Quaternion.identity, difference, fraction), t.driftOffset)
    }
  }
  let adjusted = Quaternion.multiply(t.driftOffset, raw)
  MagneticDetent.apply(adjusted, target, ~velocity, ~config=detentConfig(t.config))
}
