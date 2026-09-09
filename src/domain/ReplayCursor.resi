/** Opaque pure cursor state for timestamp-ordered replay. */
type state

let initial: state
let reset: state => state
let position: state => int
let virtualNowMs: state => float
let done: (state, array<float>) => bool
/** Clamp an event index and derive virtual time from the replay start or preceding event. */
let seekTo: (array<float>, int) => state
/** Emit exactly one next event index. */
let stepOne: (state, array<float>) => (state, option<int>)
/** Emit all next event indices whose timestamps are at or before `targetMs`. */
let advanceTo: (state, array<float>, float) => (state, array<int>)
