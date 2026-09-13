open Vitest

let rotation = (~x=0., ~y=0., ~z=0.) =>
  Quaternion.fromEuler({
    x: Quaternion.degreesToRadians(x),
    y: Quaternion.degreesToRadians(y),
    z: Quaternion.degreesToRadians(z),
  })

let expectSamePose = (t, actual: Quaternion.t, expected: Quaternion.t) =>
  t->expect(Quaternion.angle(actual, expected))->Expect.Float.toBeCloseTo(0., 7)

describe("AbsoluteRegripDetector", () => {
  test("decomposes a diagonal jump into deterministic quarter turns", t => {
    let target = rotation(~x=90., ~y=90.)
    let (afterFirst, first) = AbsoluteRegripDetector.step(AbsoluteRegripDetector.initial, target)
    let (afterSecond, second) = AbsoluteRegripDetector.step(afterFirst, target)
    let (settledState, settled) = AbsoluteRegripDetector.step(afterSecond, target)

    t
    ->expect([first, second])
    ->Expect.toEqual([
      Some({
        sensorFrameToken: CubeNotation.XTurn,
        notationToken: CubeNotation.XPrime,
      }),
      Some({
        sensorFrameToken: CubeNotation.YTurn,
        notationToken: CubeNotation.YPrime,
      }),
    ])
    t->expect(settled)->Expect.toBe(None)
    expectSamePose(t, AbsoluteRegripDetector.pose(settledState), target)
  })

  test("stays quiet between valid cube orientations", t => {
    let held = rotation(~y=45., ~z=45.)
    let (afterFirst, first) = AbsoluteRegripDetector.step(AbsoluteRegripDetector.initial, held)
    let (afterSecond, second) = AbsoluteRegripDetector.step(afterFirst, held)
    let (_, third) = AbsoluteRegripDetector.step(afterSecond, held)

    t->expect([first, second, third])->Expect.toEqual([None, None, None])
    expectSamePose(t, AbsoluteRegripDetector.pose(afterSecond), Quaternion.identity)
  })

  test("finds a bounded path between every pair of the 24 orientations", t => {
    CubeSymmetry.poses->Array.forEach(
      fromPose => {
        let fromState = ref(AbsoluteRegripDetector.initial)
        for _ in 0 to 3 {
          let (next, _) = AbsoluteRegripDetector.step(fromState.contents, fromPose)
          fromState := next
        }

        CubeSymmetry.poses->Array.forEach(
          target => {
            let detector = ref(fromState.contents)
            let observations = []
            for _ in 0 to 3 {
              let (next, observation) = AbsoluteRegripDetector.step(detector.contents, target)
              detector := next
              switch observation {
              | Some(value) => observations->Array.push(value)
              | None => ()
              }
            }

            expectSamePose(t, AbsoluteRegripDetector.pose(detector.contents), target)
            t->expect(Array.length(observations) <= 3)->Expect.toBe(true)
            let (_, settled) = AbsoluteRegripDetector.step(detector.contents, target)
            t->expect(settled)->Expect.toBe(None)
          },
        )
      },
    )
  })
})
