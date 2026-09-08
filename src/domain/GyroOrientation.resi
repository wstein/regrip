// Gyro-to-scene orientation: captures the "basis" on the first sample so the
// cube starts at `home`, then reports orientations relative to it.

/** Resting pose the cube snaps to on the first gyro sample. */
let home: Quaternion.t

type t

let make: unit => t
/** Construct an orientation tracker with a caller-provided resting pose. */
let makeWithHome: Quaternion.t => t
let resetBasis: t => unit
/** `raw` normalized against the initial sample, before applying `home`. */
let relative: (t, Quaternion.t) => Quaternion.t
/** Apply this tracker's configured resting pose to a relative orientation. */
let applyHome: (t, Quaternion.t) => Quaternion.t
/** `raw` is the cube's reported quaternion; returns the scene orientation. */
let update: (t, Quaternion.t) => Quaternion.t
