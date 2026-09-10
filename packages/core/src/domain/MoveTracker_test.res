open Vitest

describe("MoveTracker", () => {
  test("accepts contiguous serials and modulo wraparound", t => {
    let (state, first) = MoveTracker.observeMove(MoveTracker.initial, Some(254))
    let (state, second) = MoveTracker.observeMove(state, Some(255))
    let (state, third) = MoveTracker.observeMove(state, Some(0))
    t->expect(first)->Expect.toBe(None)
    t->expect(second)->Expect.toBe(None)
    t->expect(third)->Expect.toBe(None)
    t->expect(MoveTracker.trusted(state))->Expect.toBe(true)
  })

  test("emits one gap and stays untrusted until a snapshot serial arrives", t => {
    let (state, _) = MoveTracker.observeMove(MoveTracker.initial, Some(10))
    let (state, gap) = MoveTracker.observeMove(state, Some(13))
    let (state, repeated) = MoveTracker.observeMove(state, Some(15))
    let state = MoveTracker.observeSnapshot(state, Some(15))

    t->expect(gap)->Expect.toEqual(Some({previousSerial: 10, serial: 13, missing: 2}))
    t->expect(repeated)->Expect.toBe(None)
    t->expect(MoveTracker.trusted(state))->Expect.toBe(true)
  })

  test("ignores absent, duplicate, and stale serials", t => {
    let (state, absent) = MoveTracker.observeMove(MoveTracker.initial, None)
    let (state, _) = MoveTracker.observeMove(state, Some(10))
    let (state, duplicate) = MoveTracker.observeMove(state, Some(10))
    let (state, stale) = MoveTracker.observeMove(state, Some(200))
    t->expect(absent)->Expect.toBe(None)
    t->expect(duplicate)->Expect.toBe(None)
    t->expect(stale)->Expect.toBe(None)
    t->expect(MoveTracker.trusted(state))->Expect.toBe(true)
  })

  test("a serial-less snapshot restores trust and establishes a fresh baseline", t => {
    let (state, _) = MoveTracker.observeMove(MoveTracker.initial, Some(10))
    let (state, _) = MoveTracker.observeMove(state, Some(13))
    let state = MoveTracker.observeSnapshot(state, None)
    let (state, gap) = MoveTracker.observeMove(state, Some(42))
    t->expect(gap)->Expect.toBe(None)
    t->expect(MoveTracker.trusted(state))->Expect.toBe(true)
  })
})
