// Gyro-to-scene orientation: captures the "basis" on the first sample so the
// cube starts at `home`, then reports orientations relative to it.

/** Resting pose the cube snaps to on the first gyro sample. */
let home: Quaternion.t

type t

let make: unit => t
let resetBasis: t => unit
/** `raw` is the cube's reported quaternion; returns the scene orientation. */
let update: (t, Quaternion.t) => Quaternion.t
