/** Opaque pure cursor state for timestamp-ordered replay. */
@genType
type state

@genType
let initial: state
@genType
let reset: state => state
@genType
let position: state => int
@genType
let virtualNowMs: state => float
@genType
let done: (state, array<float>) => bool
/** Clamp an event index and derive virtual time from the replay start or preceding event. */
@genType
let seekTo: (array<float>, int) => state
/** Emit exactly one next event index. */
@genType
let stepOne: (state, array<float>) => (state, option<int>)
/** Emit all next event indices whose timestamps are at or before `targetMs`. */
@genType
let advanceTo: (state, array<float>, float) => (state, array<int>)
