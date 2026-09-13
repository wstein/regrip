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
@genType
let cubeTimestampLinearFit: array<timestampedMove> => array<timestampedMove>
