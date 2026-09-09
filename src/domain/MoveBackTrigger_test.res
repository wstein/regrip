open Vitest

// Threads reducer state through a sequence of moves, returning each step's trigger.
let run = (moves: array<(string, float)>): array<option<string>> => {
  let state = ref(MoveBackTrigger.initial)
  moves->Array.map(((move, timestamp)) => {
    let (next, trigger) = MoveBackTrigger.step(state.contents, move, timestamp)
    state := next
    trigger
  })
}

describe("MoveBackTrigger", () => {
  test("emits the initiating move for an inverse pair within 300ms", t => {
    t
    ->expect(run([("R", 1000.), ("R'", 1300.)]))
    ->Expect.toEqual([None, Some("R")])
  })

  test("rejects different faces, double turns, and late returns", t => {
    t->expect(run([("R", 1000.), ("U'", 1100.)]))->Expect.toEqual([None, None])
    t->expect(run([("R2", 1000.), ("R2", 1100.)]))->Expect.toEqual([None, None])
    t->expect(run([("F", 1000.), ("F'", 1301.)]))->Expect.toEqual([None, None])
  })

  test("does not overlap a matched return into another trigger", t => {
    t
    ->expect(run([("R", 1000.), ("R'", 1100.), ("R", 1200.)]))
    ->Expect.toEqual([None, Some("R"), None])
  })

  test("step is pure: replaying from the same state repeats the result", t => {
    let (started, _) = MoveBackTrigger.step(MoveBackTrigger.initial, "R", 1000.)
    let (_, first) = MoveBackTrigger.step(started, "R'", 1200.)
    let (_, again) = MoveBackTrigger.step(started, "R'", 1200.)
    t->expect(first)->Expect.toBe(Some("R"))
    t->expect(again)->Expect.toBe(first)
  })
})
