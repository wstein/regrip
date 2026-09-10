/** The 24 orientation-preserving rotations of a cube. */
let poses: array<Quaternion.t>

/**
 * Select the closest cardinal pose. A current lock is retained until a new
 * pose is closer by more than `marginRad`, preventing boundary chatter.
 */
let nearest: (Quaternion.t, option<Quaternion.t>, float) => Quaternion.t

/** Select the closest signed x/y/z quarter-turn generator for a regrip step. */
let nearestQuarterTurn: Quaternion.t => Quaternion.t
