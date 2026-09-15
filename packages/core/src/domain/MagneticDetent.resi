// Stateless, velocity-gated magnetic well around a supplied cardinal pose.

/** Well radius, inner snap radius, and the velocity above which the well
 * releases entirely, all in degrees / degrees-per-second. */
@genType
type config = {
  radiusDeg: float,
  snapDeg: float,
  velocityMax: float,
}
@genType
let defaults: config
/** Pull `raw` toward `target` by an amount that eases in near `snapDeg`,
 * fades out toward `radiusDeg`, and is gated fully open above `velocityMax`. */
@genType
let apply: (Quaternion.t, Quaternion.t, ~velocity: float=?, ~config: config=?) => Quaternion.t
