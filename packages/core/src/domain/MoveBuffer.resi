// Rolling window of recent moves (for clock-skew estimation) + the current
// solution's moves. Generic over the move type.

/** The rolling recent-move window and the current solution's move list. */
@genType
type state<'m>

@genType
let initial: unit => state<'m>
/** Append to the recent window, trimming it to the last 256. */
@genType
let pushRecent: (state<'m>, 'm) => state<'m>
/** Append to the current solution's move list. */
@genType
let pushSolution: (state<'m>, 'm) => state<'m>
/** Clear the current solution's move list, keeping the recent window. */
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
/** The current solution's moves, in the order they were pushed. */
@genType
let solutionMoves: state<'m> => array<'m>
