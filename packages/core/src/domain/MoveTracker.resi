// Pure modulo-256 move-serial integrity guard. It emits gaps; callers own
// transport recovery and player reconciliation.

type state
type gap = {previousSerial: int, serial: int, missing: int}

let initial: state
let trusted: state => bool
let observeSnapshot: (state, option<int>) => state
let observeMove: (state, option<int>) => (state, option<gap>)
