// Stateful, renderer-independent orientation magnet. It owns only the lock;
// all quaternion math and detent behaviour remain independently testable.

type config = {
  radiusDeg: float,
  snapDeg: float,
  hysteresisDeg: float,
  velocityMax: float,
}

let defaults = {
  radiusDeg: MagneticDetent.defaults.radiusDeg,
  snapDeg: MagneticDetent.defaults.snapDeg,
  hysteresisDeg: 5.,
  velocityMax: MagneticDetent.defaults.velocityMax,
}

type t = {mutable lockedPose: option<Quaternion.t>, mutable config: config}

let make = (~config=defaults): t => {lockedPose: None, config}

let reset = (t: t): unit => t.lockedPose = None

let setConfig = (t: t, config: config): unit => {
  t.config = config
  reset(t)
}

let lockedPose = (t: t): option<Quaternion.t> => t.lockedPose

let update = (t: t, raw: Quaternion.t, ~velocity=0.): Quaternion.t => {
  let target = CubeSymmetry.nearest(
    raw,
    t.lockedPose,
    Quaternion.degreesToRadians(t.config.hysteresisDeg),
  )
  t.lockedPose = Some(target)
  MagneticDetent.apply(
    raw,
    target,
    ~velocity,
    ~config={
      radiusDeg: t.config.radiusDeg,
      snapDeg: t.config.snapDeg,
      velocityMax: t.config.velocityMax,
    },
  )
}
