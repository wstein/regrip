// Typed FFI boundary for timestamp helpers exported by smartcube-web-bluetooth.
// Bindings live outside domain so domain modules remain dependency-free and
// reusable; any non-domain layer may opt into this package boundary.

type timestampedMove = {
  face: int,
  direction: int,
  move: string,
  localTimestamp: Nullable.t<float>,
  cubeTimestamp: Nullable.t<float>,
}

@module("smartcube-web-bluetooth")
external cubeTimestampCalcSkew: array<timestampedMove> => float = "cubeTimestampCalcSkew"

// Public for consumers repairing recovered GAN move timestamps even though the
// Regrip app currently needs only the skew calculation sibling.
@module("smartcube-web-bluetooth")
external cubeTimestampLinearFit: array<timestampedMove> => array<timestampedMove> =
  "cubeTimestampLinearFit"
