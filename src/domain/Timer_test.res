open Vitest

let step = Timer.step

describe("Timer.step - Activate (SPACE / touch)", () => {
  test("Idle + connected -> Ready, shows a zeroed timer in the ready phase", t => {
    let (s, effects) = step(Idle, Activate, ~connected=true)
    t->expect(s)->Expect.toEqual(Timer.Ready)
    t
    ->expect(effects)
    ->Expect.toEqual([
      Timer.SetValueMs({ms: 0.}),
      Timer.ShowTimer,
      Timer.SetPhase({phase: Timer.Phase.Ready}),
    ])
  })

  test("Idle + not connected -> stays Idle and hides", t => {
    let (s, effects) = step(Idle, Activate, ~connected=false)
    t->expect(s)->Expect.toEqual(Timer.Idle)
    t->expect(effects)->Expect.toEqual([Timer.StopLocalTimer, Timer.HideTimer])
  })

  test("Ready + Activate -> Idle", t => {
    let (s, _) = step(Ready, Activate, ~connected=true)
    t->expect(s)->Expect.toEqual(Timer.Idle)
  })

  test("Running + Activate -> Idle (abort)", t => {
    let (s, effects) = step(Running, Activate, ~connected=true)
    t->expect(s)->Expect.toEqual(Timer.Idle)
    t->expect(effects)->Expect.toEqual([Timer.StopLocalTimer, Timer.HideTimer])
  })

  test("Stopped + Activate -> Idle", t => {
    let (s, _) = step(Stopped, Activate, ~connected=true)
    t->expect(s)->Expect.toEqual(Timer.Idle)
  })
})

describe("Timer.step - solve lifecycle", () => {
  test("Ready + MoveDetected -> Running, clears solution and starts the local clock", t => {
    let (s, effects) = step(Ready, MoveDetected, ~connected=true)
    t->expect(s)->Expect.toEqual(Timer.Running)
    t
    ->expect(effects)
    ->Expect.toEqual([
      Timer.ClearSolutionMoves,
      Timer.StartLocalTimer,
      Timer.SetPhase({phase: Timer.Phase.Running}),
    ])
  })

  test("Running + Solved -> Stopped, stops the clock and shows the fitted time", t => {
    let (s, effects) = step(Running, Solved, ~connected=true)
    t->expect(s)->Expect.toEqual(Timer.Stopped)
    t
    ->expect(effects)
    ->Expect.toEqual([
      Timer.StopLocalTimer,
      Timer.SetPhase({phase: Timer.Phase.Stopped}),
      Timer.ShowFinalTime,
    ])
  })
})

describe("Timer.step - ignored inputs", () => {
  test("MoveDetected is a no-op unless Ready", t => {
    t->expect(step(Idle, MoveDetected, ~connected=true))->Expect.toEqual((Timer.Idle, []))
    t->expect(step(Running, MoveDetected, ~connected=true))->Expect.toEqual((Timer.Running, []))
    t->expect(step(Stopped, MoveDetected, ~connected=true))->Expect.toEqual((Timer.Stopped, []))
  })

  test("Solved is a no-op unless Running", t => {
    t->expect(step(Idle, Solved, ~connected=true))->Expect.toEqual((Timer.Idle, []))
    t->expect(step(Ready, Solved, ~connected=true))->Expect.toEqual((Timer.Ready, []))
  })
})

describe("Timer.step - Disconnected resets from any state", () => {
  test("Running -> Idle with clock stopped", t => {
    let (s, effects) = step(Running, Disconnected, ~connected=false)
    t->expect(s)->Expect.toEqual(Timer.Idle)
    t->expect(effects)->Expect.toEqual([Timer.StopLocalTimer, Timer.HideTimer])
  })

  test("Ready -> Idle", t => {
    let (s, _) = step(Ready, Disconnected, ~connected=false)
    t->expect(s)->Expect.toEqual(Timer.Idle)
  })

  test("Idle -> Idle", t => {
    let (s, _) = step(Idle, Disconnected, ~connected=false)
    t->expect(s)->Expect.toEqual(Timer.Idle)
  })
})

describe("Timer.step - full solve sequence", () => {
  test("threads Idle -> Ready -> Running -> Stopped -> Idle with the expected effect log", t => {
    let log = ref([])
    let state = ref(Timer.Idle)
    let feed = input => {
      let (next, effects) = step(state.contents, input, ~connected=true)
      state := next
      log := Array.concat(log.contents, effects)
    }
    feed(Activate) // -> Ready
    feed(MoveDetected) // -> Running
    feed(MoveDetected) // ignored while Running
    feed(Solved) // -> Stopped
    feed(Activate) // -> Idle

    t->expect(state.contents)->Expect.toEqual(Timer.Idle)
    t
    ->expect(log.contents)
    ->Expect.toEqual([
      Timer.SetValueMs({ms: 0.}),
      Timer.ShowTimer,
      Timer.SetPhase({phase: Timer.Phase.Ready}),
      Timer.ClearSolutionMoves,
      Timer.StartLocalTimer,
      Timer.SetPhase({phase: Timer.Phase.Running}),
      Timer.StopLocalTimer,
      Timer.SetPhase({phase: Timer.Phase.Stopped}),
      Timer.ShowFinalTime,
      Timer.StopLocalTimer,
      Timer.HideTimer,
    ])
  })
})
