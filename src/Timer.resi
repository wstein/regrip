// Solve-timer state machine. `step` is pure: next state + side effects for the
// caller to apply. Variants are @tag-normalized with explicit lowercase wire
// values (mirrored in Timer.res.d.mts).

@tag("kind")
type state =
  | @as("idle") Idle
  | @as("ready") Ready
  | @as("running") Running
  | @as("stopped") Stopped

@tag("kind")
type input =
  | @as("activate") Activate
  | @as("moveDetected") MoveDetected
  | @as("solved") Solved
  | @as("disconnected") Disconnected

module Phase: {
  @tag("kind")
  type t =
    | @as("ready") Ready
    | @as("running") Running
    | @as("stopped") Stopped
}

@tag("kind")
type effect =
  | @as("showTimer") ShowTimer
  | @as("hideTimer") HideTimer
  | @as("startLocalTimer") StartLocalTimer
  | @as("stopLocalTimer") StopLocalTimer
  | @as("clearSolutionMoves") ClearSolutionMoves
  | @as("showFinalTime") ShowFinalTime
  | @as("setPhase") SetPhase({phase: Phase.t})
  | @as("setValueMs") SetValueMs({ms: float})

let step: (state, input, ~connected: bool) => (state, array<effect>)
