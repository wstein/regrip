open Vitest

// MoveBuffer is generic over the move type; ints stand in for cube moves here.
type holder<'m> = {mutable state: MoveBuffer.state<'m>}
let make = () => {state: MoveBuffer.initial()}
let pushRecent = (holder, move) => holder.state = MoveBuffer.pushRecent(holder.state, move)
let pushSolution = (holder, move) => holder.state = MoveBuffer.pushSolution(holder.state, move)

describe("MoveBuffer - recent history", () => {
  test("caps at 256 entries, keeping the newest", t => {
    let b = make()
    for i in 1 to 300 {
      pushRecent(b, i)
    }
    let recent = MoveBuffer.recentMoves(b.state)
    t->expect(Array.length(recent))->Expect.toBe(256)
    t->expect(recent->Array.getUnsafe(0))->Expect.toBe(45) // 300 - 256 + 1
    t->expect(recent->Array.getUnsafe(255))->Expect.toBe(300)
  })

  test("recentReady flips once history exceeds 10 moves", t => {
    let b = make()
    for i in 1 to 10 {
      pushRecent(b, i)
    }
    t->expect(MoveBuffer.recentReady(b.state))->Expect.toBe(false)
    pushRecent(b, 11)
    t->expect(MoveBuffer.recentReady(b.state))->Expect.toBe(true)
  })
})

describe("MoveBuffer - solution", () => {
  test("accumulates then clears", t => {
    let b = make()
    pushSolution(b, 1)
    pushSolution(b, 2)
    t->expect(MoveBuffer.solutionMoves(b.state))->Expect.toEqual([1, 2])
    b.state = MoveBuffer.clearSolution(b.state)
    t->expect(MoveBuffer.solutionMoves(b.state))->Expect.toEqual([])
  })

  test("clearing the solution leaves recent history untouched", t => {
    let b = make()
    pushRecent(b, 7)
    pushSolution(b, 7)
    b.state = MoveBuffer.clearSolution(b.state)
    t->expect(MoveBuffer.recentMoves(b.state))->Expect.toEqual([7])
  })
})

describe("MoveBuffer.reset", () => {
  test("clears both buffers (disconnect)", t => {
    let b = make()
    pushRecent(b, 1)
    pushSolution(b, 1)
    b.state = MoveBuffer.reset(b.state)
    t->expect(MoveBuffer.recentMoves(b.state))->Expect.toEqual([])
    t->expect(MoveBuffer.solutionMoves(b.state))->Expect.toEqual([])
  })
})

describe("MoveBuffer reducer", () => {
  test("returns the same state for the same prior state and input", t => {
    let first = MoveBuffer.pushRecent(MoveBuffer.initial(), 7)
    let second = MoveBuffer.pushRecent(MoveBuffer.initial(), 7)
    t->expect(MoveBuffer.recentMoves(first))->Expect.toEqual(MoveBuffer.recentMoves(second))
  })
})
