// Typed FFI boundary for timestamp helpers exported by smartcube-web-bluetooth.
// Bindings live outside domain so domain modules remain dependency-free and
// reusable; any non-domain layer may opt into this package boundary.

@module("smartcube-web-bluetooth")
external cubeTimestampCalcSkew: array<'move> => float = "cubeTimestampCalcSkew"

@module("smartcube-web-bluetooth")
external cubeTimestampLinearFit: array<'move> => array<'move> = "cubeTimestampLinearFit"
