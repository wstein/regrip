// Solve-timer state machine, extracted from index.ts (setTimerState /
// activateTimer / the READY->RUNNING and RUNNING->STOPPED transitions).
//
// `step` is pure: it returns the next state plus the side effects the caller
// (index.ts) must apply to the DOM / local clock / solution buffer.
//
// All three variants are `@tag`-normalized with explicit lowercase wire values
// so the compiled JS shape remains a plain discriminated union for genType.

@tag("kind")
type state =
  | @as("idle") Idle
  | @as("ready") Ready
  | @as("running") Running
  | @as("stopped") Stopped

@tag("kind")
type input =
  | @as("activate") Activate // SPACE key or touch on the cube
  | @as("moveDetected") MoveDetected // a cube move arrived
  | @as("solved") Solved // the rendered pattern reached the solved state
  | @as("disconnected") Disconnected // the cube connection dropped

// Display phase of the running timer; index.ts maps this to a colour.
module Phase = {
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
  | @as("showFinalTime") ShowFinalTime // compute the fitted solve time and display it
  | @as("setPhase") SetPhase({phase: Phase.t})
  | @as("setValueMs") SetValueMs({ms: float})

let idle = (Idle, [StopLocalTimer, HideTimer])

let step = (state: state, input: input, ~connected: bool): (state, array<effect>) =>
  switch (state, input) {
  | (_, Disconnected) => idle
  | (Idle, Activate) =>
    connected ? (Ready, [SetValueMs({ms: 0.}), ShowTimer, SetPhase({phase: Ready})]) : idle
  | (Ready | Running | Stopped, Activate) => idle
  | (Ready, MoveDetected) => (
      Running,
      [ClearSolutionMoves, StartLocalTimer, SetPhase({phase: Running})],
    )
  | (Running, Solved) => (Stopped, [StopLocalTimer, SetPhase({phase: Stopped}), ShowFinalTime])
  | (Idle | Running | Stopped, MoveDetected)
  | (Idle | Ready | Stopped, Solved) => (state, [])
  }
