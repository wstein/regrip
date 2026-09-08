// Rolling window of recent moves (for clock-skew estimation) + the current
// solution's moves. Generic over the move type.

type t<'m>

let make: unit => t<'m>
/** Append to the recent window, trimming it to the last 256. */
let pushRecent: (t<'m>, 'm) => unit
let pushSolution: (t<'m>, 'm) => unit
let clearSolution: t<'m> => unit
/** Clear both buffers (on disconnect). */
let reset: t<'m> => unit
/** True once the recent window is large enough for a meaningful skew estimate. */
let recentReady: t<'m> => bool
let recentMoves: t<'m> => array<'m>
let solutionMoves: t<'m> => array<'m>
