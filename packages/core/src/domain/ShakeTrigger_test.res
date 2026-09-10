open Vitest

// Wire order is x, y, z, w; the detector is deliberately axis-agnostic, so a
// single-axis pose is enough to reproduce cubetrace's synthetic vectors.
let pose = (degrees: float): Quaternion.t => {
  let half = Quaternion.degreesToRadians(degrees) /. 2.
  Quaternion.normalize({x: 0., y: Math.sin(half), z: 0., w: Math.cos(half)})
}

// One raw GoCube orientation reading, exactly as it arrives on the wire.
let raw = (x: float, y: float, z: float, w: float): Quaternion.t =>
  Quaternion.normalize({x, y, z, w})

type feed = {mutable state: ShakeTrigger.state, mutable hits: array<ShakeTrigger.detection>}
let feed = (): feed => {state: ShakeTrigger.initial, hits: []}

let orient = (f: feed, at: float, q: Quaternion.t): unit => {
  let (next, hit) = ShakeTrigger.observe(f.state, at, q)
  f.state = next
  switch hit {
  | Some(detection) => f.hits = [...f.hits, detection]
  | None => ()
  }
}
let face = (f: feed, at: float): unit => f.state = ShakeTrigger.observeMove(f.state, at)

// cubetrace's `burst` helper, in milliseconds: forward, back, forward, back.
let burst = (f: feed, ~from: float=0.): unit => {
  orient(f, from, pose(0.))
  orient(f, from +. 60., pose(15.))
  orient(f, from +. 120., pose(-15.))
  orient(f, from +. 180., pose(15.))
  orient(f, from +. 240., pose(-15.))
}

describe("ShakeTrigger", () => {
  test("reports a burst of rapid orientation changes after the turn guard", t => {
    let f = feed()
    burst(f)
    orient(f, 500., pose(-15.))
    t->expect(f.hits)->Expect.toEqual([])
    orient(f, 700., pose(-15.))
    t->expect(Array.length(f.hits))->Expect.toBe(1)
    let detection = Array.getUnsafe(f.hits, 0)
    t->expect(detection.steps)->Expect.toBe(4)
    t->expect(detection.reversals)->Expect.toBe(3)
    t->expect(detection.spanMs)->Expect.toBe(180.)
  })

  test("does not call one fast movement a shake", t => {
    let f = feed()
    orient(f, 0., pose(0.))
    orient(f, 60., pose(45.))
    orient(f, 600., pose(45.))
    t->expect(f.hits)->Expect.toEqual([])
  })

  test("does not call a fast one-direction turn a shake", t => {
    let f = feed()
    orient(f, 0., pose(0.))
    orient(f, 60., pose(15.))
    orient(f, 120., pose(30.))
    orient(f, 180., pose(45.))
    orient(f, 240., pose(60.))
    orient(f, 700., pose(60.))
    t->expect(f.hits)->Expect.toEqual([])
  })

  test("suppresses a burst near a face rotation on either side", t => {
    let before = feed()
    face(before, 0.)
    burst(before, ~from=100.)
    orient(before, 800., pose(-15.))
    t->expect(before.hits)->Expect.toEqual([])

    let after = feed()
    burst(after)
    face(after, 300.)
    orient(after, 700., pose(-15.))
    t->expect(after.hits)->Expect.toEqual([])
  })

  test("does not join ordinary motion across a telemetry gap", t => {
    let f = feed()
    orient(f, 0., pose(0.))
    orient(f, 60., pose(12.))
    orient(f, 500., pose(25.))
    orient(f, 560., pose(39.))
    orient(f, 1100., pose(39.))
    t->expect(f.hits)->Expect.toEqual([])
  })

  test("is a deterministic pure reducer", t => {
    let (afterState, _) = ShakeTrigger.observe(ShakeTrigger.initial, 0., pose(0.))
    let (_, first) = ShakeTrigger.observe(afterState, 60., pose(15.))
    let (_, again) = ShakeTrigger.observe(afterState, 60., pose(15.))
    t->expect(first)->Expect.toEqual(again)
  })

  test("matches the five recorded shake occurrence timestamps", t => {
    // The five forward/back/forward sequences read from `captures/gocube-shake.jsonl`
    // in cubetrace, kept verbatim as small test vectors.
    let samples = [
      (1788376655649089., raw(10656., 8619., -5523., -7012.)),
      (1788376655709070., raw(11208., 7822., -4472., -7790.)),
      (1788376655768894., raw(8111., 10499., -8107., -5075.)),
      (1788376655830410., raw(9553., 8894., -6885., -7052.)),
      (1788376655920105., raw(8599., 9965., -7950., -5573.)),
      (1788376658559002., raw(2830., -2961., -1254., -15785.)),
      (1788376658618947., raw(2175., 2011., -1836., -15980.)),
      (1788376658679832., raw(2500., -2669., -1255., -15892.)),
      (1788376658769403., raw(2313., 864., -2003., -16044.)),
      (1788376658830467., raw(2786., -659., -1977., -15981.)),
      (1788376660988986., raw(-804., -1973., 349., -16213.)),
      (1788376661080190., raw(-1729., -3363., -191., -15912.)),
      (1788376661140220., raw(-2031., 2379., 1190., -16010.)),
      (1788376661200179., raw(-2698., -1175., 264., -16087.)),
      (1788376661258961., raw(-2652., 936., 647., -16099.)),
      (1788376664890297., raw(-11228., -904., 9364., -7281.)),
      (1788376664950233., raw(-10841., 2941., 8083., -8717.)),
      (1788376665010215., raw(-10873., 800., 9259., -7931.)),
      (1788376665100238., raw(-10314., 3419., 8065., -9186.)),
      (1788376665160291., raw(-10603., 2129., 8779., -8572.)),
      (1788376667050279., raw(-11486., 546., 7835., -8595.)),
      (1788376667140435., raw(-11426., -2379., 8982., -7114.)),
      (1788376667200286., raw(-11289., -216., 8177., -8552.)),
      (1788376667260277., raw(-10932., 1945., 6951., -9792.)),
      (1788376667320424., raw(-11289., -522., 8182., -8535.)),
    ]
    let ms = (micros: float): float => micros /. 1000.

    let f = feed()
    samples->Array.forEach(((at, quaternion)) => orient(f, ms(at), quaternion))
    let (lastAt, lastQuaternion) = Array.getUnsafe(samples, Array.length(samples) - 1)
    orient(f, ms(lastAt) +. 500., lastQuaternion)

    t
    ->expect(f.hits->Array.map(detection => detection.at))
    ->Expect.toEqual([
      ms(1788376655920105.),
      ms(1788376658830467.),
      ms(1788376661258961.),
      ms(1788376665160291.),
      ms(1788376667320424.),
    ])
  })
})
