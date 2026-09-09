open Vitest

describe("ReplayCursor", () => {
  let timestamps = [10., 10., 25., 40.]

  test("steps one event at a time, including equal timestamps", t => {
    let (one, first) = ReplayCursor.stepOne(ReplayCursor.initial, timestamps)
    let (two, second) = ReplayCursor.stepOne(one, timestamps)
    t->expect(first)->Expect.toBe(Some(0))
    t->expect(second)->Expect.toBe(Some(1))
    t->expect(ReplayCursor.virtualNowMs(two))->Expect.toBe(10.)
  })

  test("advances across a timestamp burst without passing the target", t => {
    let (state, emitted) = ReplayCursor.advanceTo(ReplayCursor.initial, timestamps, 25.)
    t->expect(emitted)->Expect.toEqual([0, 1, 2])
    t->expect(ReplayCursor.position(state))->Expect.toBe(3)
    t->expect(ReplayCursor.virtualNowMs(state))->Expect.toBe(25.)
  })

  test("clamps seek and reset state deterministically", t => {
    let start = ReplayCursor.seekTo(timestamps, 0)
    t->expect(ReplayCursor.virtualNowMs(start))->Expect.toBe(10.)
    let middle = ReplayCursor.seekTo(timestamps, 2)
    t->expect(ReplayCursor.position(middle))->Expect.toBe(2)
    t->expect(ReplayCursor.virtualNowMs(middle))->Expect.toBe(10.)
    t->expect(ReplayCursor.position(ReplayCursor.seekTo(timestamps, 99)))->Expect.toBe(4)
    t->expect(ReplayCursor.reset(middle))->Expect.toEqual(ReplayCursor.initial)
  })

  test("handles an empty sequence", t => {
    let (state, emitted) = ReplayCursor.advanceTo(ReplayCursor.initial, [], 100.)
    t->expect(emitted)->Expect.toEqual([])
    t->expect(ReplayCursor.done(state, []))->Expect.toBe(true)
  })
})
