// Rolling window of recent moves (for clock-skew estimation) + the current
// solution's moves. Generic over the move type.

type state<'m>

let initial: unit => state<'m>
/** Append to the recent window, trimming it to the last 256. */
let pushRecent: (state<'m>, 'm) => state<'m>
let pushSolution: (state<'m>, 'm) => state<'m>
let clearSolution: state<'m> => state<'m>
/** Clear both buffers (on disconnect). */
let reset: state<'m> => state<'m>
/** True once the recent window is large enough for a meaningful skew estimate. */
let recentReady: state<'m> => bool
let recentMoves: state<'m> => array<'m>
let solutionMoves: state<'m> => array<'m>
