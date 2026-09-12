// Pure modulo-256 move-serial integrity guard. It emits gaps; callers own
// transport recovery and player reconciliation.

@genType
type state
@genType
type gap = {previousSerial: int, serial: int, missing: int}

@genType
let initial: state
@genType
let trusted: state => bool
@genType
let observeSnapshot: (state, option<int>) => state
@genType
let observeMove: (state, option<int>) => (state, option<gap>)
