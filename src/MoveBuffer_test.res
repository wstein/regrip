open Vitest

// MoveBuffer is generic over the move type; ints stand in for cube moves here.

describe("MoveBuffer - recent history", () => {
  test("caps at 256 entries, keeping the newest", t => {
    let b = MoveBuffer.make()
    for i in 1 to 300 {
      MoveBuffer.pushRecent(b, i)
    }
    let recent = MoveBuffer.recentMoves(b)
    t->expect(Array.length(recent))->Expect.toBe(256)
    t->expect(recent->Array.getUnsafe(0))->Expect.toBe(45) // 300 - 256 + 1
    t->expect(recent->Array.getUnsafe(255))->Expect.toBe(300)
  })

  test("recentReady flips once history exceeds 10 moves", t => {
    let b = MoveBuffer.make()
    for i in 1 to 10 {
      MoveBuffer.pushRecent(b, i)
    }
    t->expect(MoveBuffer.recentReady(b))->Expect.toBe(false)
    MoveBuffer.pushRecent(b, 11)
    t->expect(MoveBuffer.recentReady(b))->Expect.toBe(true)
  })
})

describe("MoveBuffer - solution", () => {
  test("accumulates then clears", t => {
    let b = MoveBuffer.make()
    MoveBuffer.pushSolution(b, 1)
    MoveBuffer.pushSolution(b, 2)
    t->expect(MoveBuffer.solutionMoves(b))->Expect.toEqual([1, 2])
    MoveBuffer.clearSolution(b)
    t->expect(MoveBuffer.solutionMoves(b))->Expect.toEqual([])
  })

  test("clearing the solution leaves recent history untouched", t => {
    let b = MoveBuffer.make()
    MoveBuffer.pushRecent(b, 7)
    MoveBuffer.pushSolution(b, 7)
    MoveBuffer.clearSolution(b)
    t->expect(MoveBuffer.recentMoves(b))->Expect.toEqual([7])
  })
})

describe("MoveBuffer.reset", () => {
  test("clears both buffers (disconnect)", t => {
    let b = MoveBuffer.make()
    MoveBuffer.pushRecent(b, 1)
    MoveBuffer.pushSolution(b, 1)
    MoveBuffer.reset(b)
    t->expect(MoveBuffer.recentMoves(b))->Expect.toEqual([])
    t->expect(MoveBuffer.solutionMoves(b))->Expect.toEqual([])
  })
})
