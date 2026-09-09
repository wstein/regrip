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
    t->expect(observation.sensorFrameToken)->Expect.toBe(RegripDetector.SensorX)
    t->expect(observation.notationToken)->Expect.toBe(RegripDetector.NotationXPrime)
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
      RegripDetector.NotationXPrime,
      RegripDetector.NotationXPrime,
      RegripDetector.NotationXPrime,
      RegripDetector.NotationXPrime,
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
    ->Expect.toEqual([RegripDetector.NotationXPrime, RegripDetector.NotationYPrime])
    t
    ->expect(Quaternion.angle(Quaternion.multiply(x, y), Quaternion.multiply(y, x)) > 0.)
    ->Expect.toBe(true)
  })

  test("maps canonical URFDLB and BOYGRW through paired rotations", t => {
    t->expect(RegripDetector.faceOrderForSensor("x"))->Expect.toBe("BRUFLD")
    t->expect(RegripDetector.faceOrderForNotation("x"))->Expect.toBe("FRDBLU")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "BRUFLD"))->Expect.toBe("WOBYRG")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "FRDBLU"))->Expect.toBe("YOGWRB")
    t->expect(RegripDetector.faceOrderForSensor("y"))->Expect.toBe("UFLDBR")
    t->expect(RegripDetector.faceOrderForNotation("y"))->Expect.toBe("UBRDFL")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "UFLDBR"))->Expect.toBe("BYRGWO")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "UBRDFL"))->Expect.toBe("BWOGYR")
    t->expect(RegripDetector.faceOrderForSensor("z"))->Expect.toBe("RDFLUB")
    t->expect(RegripDetector.faceOrderForNotation("z"))->Expect.toBe("LUFRDB")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "RDFLUB"))->Expect.toBe("OGYRBW")
    t->expect(RegripDetector.permuteFaceOrder("BOYGRW", "LUFRDB"))->Expect.toBe("RBYOGW")
  })
})
