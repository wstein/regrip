// Rolling window of recent moves (for clock-skew estimation) + the current
// solution's moves. Generic over the move type.

@genType
type state<'m>

@genType
let initial: unit => state<'m>
/** Append to the recent window, trimming it to the last 256. */
@genType
let pushRecent: (state<'m>, 'm) => state<'m>
@genType
let pushSolution: (state<'m>, 'm) => state<'m>
@genType
let clearSolution: state<'m> => state<'m>
/** Clear both buffers (on disconnect). */
@genType
let reset: state<'m> => state<'m>
/** True once the recent window is large enough for a meaningful skew estimate. */
@genType
let recentReady: state<'m> => bool
@genType
let recentMoves: state<'m> => array<'m>
@genType
let solutionMoves: state<'m> => array<'m>
