open Vitest

let snapshot = (serial, facelets): SnapshotDeduper.snapshot => {serial, facelets}

describe("SnapshotDeduper", () => {
  test("suppresses an ordinary unchanged snapshot", t => {
    let (state, first) = SnapshotDeduper.observe(SnapshotDeduper.initial, snapshot(Some(7), "U"))
    let (_, repeated) = SnapshotDeduper.observe(state, snapshot(Some(7), "U"))
    t->expect(first)->Expect.toBe(true)
    t->expect(repeated)->Expect.toBe(false)
  })

  test("keeps an unchanged response for each pending request", t => {
    let (state, _) = SnapshotDeduper.observe(SnapshotDeduper.initial, snapshot(Some(7), "U"))
    let state = state->SnapshotDeduper.request->SnapshotDeduper.request
    let (state, firstResponse) = SnapshotDeduper.observe(state, snapshot(Some(7), "U"))
    let (_, secondResponse) = SnapshotDeduper.observe(state, snapshot(Some(7), "U"))
    t->expect(firstResponse)->Expect.toBe(true)
    t->expect(secondResponse)->Expect.toBe(true)
  })

  test("emits a changed snapshot without a pending request", t => {
    let (state, _) = SnapshotDeduper.observe(SnapshotDeduper.initial, snapshot(Some(7), "U"))
    let (_, changed) = SnapshotDeduper.observe(state, snapshot(Some(8), "R"))
    t->expect(changed)->Expect.toBe(true)
  })

  test("releases a reservation when its request fails", t => {
    let (state, _) = SnapshotDeduper.observe(SnapshotDeduper.initial, snapshot(Some(7), "U"))
    let state = state->SnapshotDeduper.request->SnapshotDeduper.cancel
    let (_, repeated) = SnapshotDeduper.observe(state, snapshot(Some(7), "U"))
    t->expect(repeated)->Expect.toBe(false)
  })
})
