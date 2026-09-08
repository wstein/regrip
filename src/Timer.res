// Solve-timer state machine, extracted from index.ts (setTimerState /
// activateTimer / the READY->RUNNING and RUNNING->STOPPED transitions).
//
// `step` is pure: it returns the next state plus the side effects the caller
// (index.ts) must apply to the DOM / local clock / solution buffer.

type state =
  | Idle
  | Ready
  | Running
  | Stopped

type input =
  | Activate // SPACE key or touch on the cube
  | MoveDetected // a cube move arrived
  | Solved // the rendered pattern reached the solved state
  | Disconnected // the cube connection dropped

type effect =
  | ShowTimer
  | HideTimer
  | SetColor(string)
  | SetValueMs(float)
  | StartLocalTimer
  | StopLocalTimer
  | ClearSolutionMoves
  | ShowFinalTime // compute the fitted solve time and display it

let colorReady = "#0f0"
let colorRunning = "#999"
let colorStopped = "#fff"

let idle = (Idle, [StopLocalTimer, HideTimer])

let step = (state: state, input: input, ~connected: bool): (state, array<effect>) =>
  switch (state, input) {
  | (_, Disconnected) => idle
  | (Idle, Activate) =>
    connected ? (Ready, [SetValueMs(0.), ShowTimer, SetColor(colorReady)]) : idle
  | (Ready | Running | Stopped, Activate) => idle
  | (Ready, MoveDetected) => (Running, [ClearSolutionMoves, StartLocalTimer, SetColor(colorRunning)])
  | (Running, Solved) => (Stopped, [StopLocalTimer, SetColor(colorStopped), ShowFinalTime])
  | (Idle | Running | Stopped, MoveDetected)
  | (Idle | Ready | Stopped, Solved) => (state, [])
  }
