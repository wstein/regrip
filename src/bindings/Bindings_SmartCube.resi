/** Typed FFI wrappers for timestamp helpers exported by smartcube-web-bluetooth.
 *
 * This module lives outside domain so domain stays dependency-free and reusable.
 */
let cubeTimestampCalcSkew: array<'move> => float
let cubeTimestampLinearFit: array<'move> => array<'move>
