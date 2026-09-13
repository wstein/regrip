/** Typed FFI wrappers for timestamp helpers exported by smartcube-web-bluetooth.
 *
 * This module lives outside domain so domain stays dependency-free and reusable.
 */
@genType
type timestampedMove = {
  face: int,
  direction: int,
  move: string,
  localTimestamp: Nullable.t<float>,
  cubeTimestamp: Nullable.t<float>,
}

@genType
let cubeTimestampCalcSkew: array<timestampedMove> => float
/** Public for consumers repairing recovered GAN move timestamps, even though
 * the Regrip app currently needs only its skew-calculation sibling above. */
@genType
let cubeTimestampLinearFit: array<timestampedMove> => array<timestampedMove>
