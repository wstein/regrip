// Pure modulo-256 move-serial integrity guard. It emits gaps; callers own
// transport recovery and player reconciliation.

@genType
type state
/** A detected discontinuity in the move-serial stream. */
@genType
type gap = {previousSerial: int, serial: int, missing: int}

@genType
let initial: state
/** Whether the tracker currently believes it hasn't missed a move. */
@genType
let trusted: state => bool
/** Restore trust from an authoritative snapshot's serial, if any. */
@genType
let observeSnapshot: (state, option<int>) => state
/** Observe one move's serial; emits a `gap` on an unexpected jump, and
 * suppresses repeat emissions while trust remains lost. */
@genType
let observeMove: (state, option<int>) => (state, option<gap>)
