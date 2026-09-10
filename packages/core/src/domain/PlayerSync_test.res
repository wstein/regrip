open Vitest

describe("PlayerSync", () => {
  test("buffers moves until the matching snapshot result is installed", t => {
    let (snapshot, generation) = PlayerSync.beginSnapshot(PlayerSync.initial)
    let (withR, rEffects) = PlayerSync.move(snapshot, "R")
    let (withU, uEffects) = PlayerSync.move(withR, "U'")
    let (_, resolved) = PlayerSync.resolve(withU, generation, "F2")

    t->expect(rEffects)->Expect.toEqual([])
    t->expect(uEffects)->Expect.toEqual([])
    t
    ->expect(resolved)
    ->Expect.toEqual([
      PlayerSync.SetAlgorithm({algorithm: "F2"}),
      PlayerSync.AddMove({move: "R"}),
      PlayerSync.AddMove({move: "U'"}),
    ])
  })

  test("drops a stale solver result after a newer snapshot arrives", t => {
    let (first, firstGeneration) = PlayerSync.beginSnapshot(PlayerSync.initial)
    let (second, secondGeneration) = PlayerSync.beginSnapshot(first)
    let (withMove, _) = PlayerSync.move(second, "D")
    let (unchanged, staleEffects) = PlayerSync.resolve(withMove, firstGeneration, "R")
    let (_, currentEffects) = PlayerSync.resolve(unchanged, secondGeneration, "F")

    t->expect(staleEffects)->Expect.toEqual([])
    t
    ->expect(currentEffects)
    ->Expect.toEqual([PlayerSync.SetAlgorithm({algorithm: "F"}), PlayerSync.AddMove({move: "D"})])
  })

  test("retains buffered moves when a newer matching snapshot supersedes a solve", t => {
    let (first, _) = PlayerSync.beginSnapshot(PlayerSync.initial)
    let (withR, _) = PlayerSync.move(first, "R")
    let (second, secondGeneration) = PlayerSync.beginSnapshot(withR)
    let (withU, _) = PlayerSync.move(second, "U")
    let (_, effects) = PlayerSync.confirm(withU, secondGeneration)

    t
    ->expect(effects)
    ->Expect.toEqual([PlayerSync.AddMove({move: "R"}), PlayerSync.AddMove({move: "U"})])
  })

  test("applies moves immediately outside a snapshot solve", t => {
    let (_, effects) = PlayerSync.move(PlayerSync.initial, "L2")
    t->expect(effects)->Expect.toEqual([PlayerSync.AddMove({move: "L2"})])
  })

  test("releases queued moves without resetting after a matching snapshot", t => {
    let (snapshot, generation) = PlayerSync.beginSnapshot(PlayerSync.initial)
    let (withMove, _) = PlayerSync.move(snapshot, "F'")
    let (_, effects) = PlayerSync.confirm(withMove, generation)
    t->expect(effects)->Expect.toEqual([PlayerSync.AddMove({move: "F'"})])
  })

  test("reset clears queued moves and clears the player", t => {
    let (snapshot, _) = PlayerSync.beginSnapshot(PlayerSync.initial)
    let (withMove, _) = PlayerSync.move(snapshot, "B")
    let (_, effects) = PlayerSync.reset(withMove)
    t->expect(effects)->Expect.toEqual([PlayerSync.SetAlgorithm({algorithm: ""})])
  })

  test("invalidate drops queued work without emitting a player effect", t => {
    let (snapshot, generation) = PlayerSync.beginSnapshot(PlayerSync.initial)
    let (withMove, _) = PlayerSync.move(snapshot, "R")
    let invalidated = PlayerSync.invalidate(withMove)
    let (_, effects) = PlayerSync.resolve(invalidated, generation, "U")
    t->expect(effects)->Expect.toEqual([])
  })
})
