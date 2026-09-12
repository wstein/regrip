open Vitest

let rotation = (~x=0., ~y=0., ~z=0.) =>
  Quaternion.fromEuler({
    x: Quaternion.degreesToRadians(x),
    y: Quaternion.degreesToRadians(y),
    z: Quaternion.degreesToRadians(z),
  })

type holder = {mutable state: RegripDetector.state}
let make = () => {state: RegripDetector.initial}
let observe = (holder, q) => {
  let (nextState, result) = RegripDetector.step(holder.state, q)
  holder.state = nextState
  switch result {
  | Some(observation) => observation
  | None => failwith("expected a virtual regrip")
  }
}

describe("RegripDetector", () => {
  test("ignores ordinary handling below its threshold", t => {
    let detector = make()
    let (afterIdentity, identityResult) = RegripDetector.step(detector.state, Quaternion.identity)
    detector.state = afterIdentity
    t->expect(identityResult)->Expect.toBe(None)
    let (_, result) = RegripDetector.step(detector.state, rotation(~x=59.))
    t->expect(result)->Expect.toBe(None)
  })

  test("is a deterministic pure reducer", t => {
    let input = rotation(~y=66.)
    let (firstState, firstObservation) = RegripDetector.step(RegripDetector.initial, input)
    let (secondState, secondObservation) = RegripDetector.step(RegripDetector.initial, input)
    t->expect(firstObservation)->Expect.toEqual(secondObservation)
    let (_, firstFollowup) = RegripDetector.step(firstState, rotation(~y=156.))
    let (_, secondFollowup) = RegripDetector.step(secondState, rotation(~y=156.))
    t->expect(firstFollowup)->Expect.toEqual(secondFollowup)
  })

  test("emits opposite Singmaster notation for a positive sensor turn", t => {
    let detector = make()
    let observation = observe(detector, rotation(~x=66.))
    t->expect(observation.sensorFrameToken)->Expect.toBe(CubeNotation.XTurn)
    t->expect(observation.notationToken)->Expect.toBe(CubeNotation.XPrime)
  })

  test("does not hunt between axes for a held pose outside every quarter snap band", t => {
    let detector = make()
    // 45° around both Y and Z is 62.8° from identity and from every signed
    // quarter generator. It previously caused a static y/y' regrip loop.
    let held = rotation(~y=45., ~z=45.)
    let results = [0, 1, 2, 3, 4, 5]->Array.map(
      _ => {
        let (nextState, result) = RegripDetector.step(detector.state, held)
        detector.state = nextState
        result
      },
    )
    t->expect(results)->Expect.toEqual([None, None, None, None, None, None])
    let (_, next) = RegripDetector.step(detector.state, rotation(~x=66.))
    t
    ->expect(next)
    ->Expect.toEqual(
      Some({sensorFrameToken: CubeNotation.XTurn, notationToken: CubeNotation.XPrime}),
    )
  })

  test("commits one settled quarter during a slow continuous turn", t => {
    let detector = make()
    let results = [0., 30., 66., 75., 90.]->Array.map(
      degrees => {
        let (nextState, result) = RegripDetector.step(detector.state, rotation(~x=degrees))
        detector.state = nextState
        result
      },
    )
    t
    ->expect(results)
    ->Expect.toEqual([
      None,
      None,
      Some({sensorFrameToken: CubeNotation.XTurn, notationToken: CubeNotation.XPrime}),
      None,
      None,
    ])
  })

  test("does not guess a single quarter for an ambiguous half turn", t => {
    let (nextState, result) = RegripDetector.step(RegripDetector.initial, rotation(~x=180.))
    t->expect(result)->Expect.toBe(None)
    let (_, next) = RegripDetector.step(nextState, rotation(~x=66.))
    t
    ->expect(next)
    ->Expect.toEqual(
      Some({sensorFrameToken: CubeNotation.XTurn, notationToken: CubeNotation.XPrime}),
    )
  })

  test("projects equivalent quaternion signs onto the same cardinal regrip", t => {
    let positive = rotation(~x=66.)
    // q and -q encode exactly the same physical orientation. The cardinal
    // projection must therefore choose the same axis and polarity for both.
    let negative: Quaternion.t = {
      x: -.positive.x,
      y: -.positive.y,
      z: -.positive.z,
      w: -.positive.w,
    }
    let (_, positiveObservation) = RegripDetector.step(RegripDetector.initial, positive)
    let (_, negativeObservation) = RegripDetector.step(RegripDetector.initial, negative)
    t->expect(negativeObservation)->Expect.toEqual(positiveObservation)
  })

  test("rebases to cardinal steps during a continuous full turn", t => {
    let detector = make()
    let tokens =
      [66., 156., 246., 336.]->Array.map(
        degrees => observe(detector, rotation(~x=degrees)).notationToken,
      )
    t
    ->expect(tokens)
    ->Expect.toEqual([
      CubeNotation.XPrime,
      CubeNotation.XPrime,
      CubeNotation.XPrime,
      CubeNotation.XPrime,
    ])
  })

  test("preserves local mixed-axis order", t => {
    let detector = make()
    let x = rotation(~x=90.)
    let y = rotation(~y=90.)
    let first = observe(detector, rotation(~x=66.))
    let second = observe(detector, Quaternion.multiply(x, rotation(~y=66.)))
    t
    ->expect([first.notationToken, second.notationToken])
    ->Expect.toEqual([CubeNotation.XPrime, CubeNotation.YPrime])
    t
    ->expect(Quaternion.angle(Quaternion.multiply(x, y), Quaternion.multiply(y, x)) > 0.)
    ->Expect.toBe(true)
  })

  test("maps canonical URFDLB and BOYGRW through paired rotations", t => {
    t->expect(RegripDetector.faceOrderForSensor(CubeNotation.XTurn))->Expect.toBe("BRUFLD")
    t->expect(RegripDetector.faceOrderForNotation(CubeNotation.XTurn))->Expect.toBe("FRDBLU")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "BRUFLD"))->Expect.toBe("WOBYRG")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "FRDBLU"))->Expect.toBe("YOGWRB")
    t->expect(RegripDetector.faceOrderForSensor(CubeNotation.YTurn))->Expect.toBe("UFLDBR")
    t->expect(RegripDetector.faceOrderForNotation(CubeNotation.YTurn))->Expect.toBe("UBRDFL")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "UFLDBR"))->Expect.toBe("BYRGWO")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "UBRDFL"))->Expect.toBe("BWOGYR")
    t->expect(RegripDetector.faceOrderForSensor(CubeNotation.ZTurn))->Expect.toBe("RDFLUB")
    t->expect(RegripDetector.faceOrderForNotation(CubeNotation.ZTurn))->Expect.toBe("LUFRDB")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "RDFLUB"))->Expect.toBe("OGYRBW")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "LUFRDB"))->Expect.toBe("RBYOGW")
  })

  test("maps inverse and half-turn face orders", t => {
    [
      (CubeNotation.XPrime, "FRDBLU", "BRUFLD"),
      (CubeNotation.YPrime, "UBRDFL", "UFLDBR"),
      (CubeNotation.ZPrime, "LUFRDB", "RDFLUB"),
      (CubeNotation.XDouble, "URFDLB", "URFDLB"),
    ]->Array.forEach(
      ((token, sensor, notation)) => {
        t->expect(RegripDetector.faceOrderForSensor(token))->Expect.toBe(sensor)
        t->expect(RegripDetector.faceOrderForNotation(token))->Expect.toBe(notation)
      },
    )
  })
})
