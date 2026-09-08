open Vitest

let step = Timer.step

describe("Timer.step - Activate (SPACE / touch)", () => {
  test("Idle + connected -> Ready, shows a zeroed green timer", t => {
    let (s, effects) = step(Idle, Activate, ~connected=true)
    t->expect(s)->Expect.toEqual(Timer.Ready)
    t->expect(effects)->Expect.toEqual([
      Timer.SetValueMs(0.),
      Timer.ShowTimer,
      Timer.SetColor("#0f0"),
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
    t->expect(effects)->Expect.toEqual([
      Timer.ClearSolutionMoves,
      Timer.StartLocalTimer,
      Timer.SetColor("#999"),
    ])
  })

  test("Running + Solved -> Stopped, stops the clock and shows the fitted time", t => {
    let (s, effects) = step(Running, Solved, ~connected=true)
    t->expect(s)->Expect.toEqual(Timer.Stopped)
    t->expect(effects)->Expect.toEqual([
      Timer.StopLocalTimer,
      Timer.SetColor("#fff"),
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
