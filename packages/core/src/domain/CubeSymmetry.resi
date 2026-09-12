/** The 24 orientation-preserving rotations of a cube. */
@genType
let poses: array<Quaternion.t>

/**
 * Select the closest cardinal pose. A current lock is retained until a new
 * pose is closer by more than `marginRad`, preventing boundary chatter.
 */
@genType
let nearest: (Quaternion.t, option<Quaternion.t>, float) => Quaternion.t

/** Select the closest signed x/y/z quarter-turn generator for a regrip step. */
@genType
let nearestQuarterTurn: Quaternion.t => Quaternion.t
