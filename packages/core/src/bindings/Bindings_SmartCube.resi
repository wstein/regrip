/** Typed FFI wrappers for timestamp helpers exported by smartcube-web-bluetooth.
 *
 * This module lives outside domain so domain stays dependency-free and reusable.
 */
@genType
let cubeTimestampCalcSkew: array<'move> => float
@genType
let cubeTimestampLinearFit: array<'move> => array<'move>
