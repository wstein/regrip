// The smartcube package exposes timestamp helpers in JavaScript. Keep that
// boundary here so application code never imports untyped helpers directly.

@module("smartcube-web-bluetooth")
external cubeTimestampCalcSkew: array<'move> => float = "cubeTimestampCalcSkew"

@module("smartcube-web-bluetooth")
external cubeTimestampLinearFit: array<'move> => array<'move> = "cubeTimestampLinearFit"
