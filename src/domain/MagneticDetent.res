// Stateless, velocity-gated magnetic well around a supplied cardinal pose.

type config = {
  radiusDeg: float,
  snapDeg: float,
  velocityMax: float,
}

let defaults = {radiusDeg: 35., snapDeg: 4., velocityMax: 2.5}

let radians = degrees => degrees *. Math.Constants.pi /. 180.

let apply = (raw: Quaternion.t, target: Quaternion.t, ~velocity=0., ~config=defaults): Quaternion.t => {
  let angle = Quaternion.angle(raw, target)
  let radius = radians(config.radiusDeg)
  let snap = radians(config.snapDeg)
  let gate = 1. -. Math.min(1., Math.abs(velocity) /. config.velocityMax)
  if angle >= radius || gate <= 0. {
    raw
  } else if angle <= snap {
    // Smooth the final degree into the exact snap pose.
    let core = radians(1.)
    let pull = angle <= snap -. core ? 1. : (snap -. angle) /. core
    Quaternion.slerp(raw, target, pull *. gate)
  } else {
    let n = angle /. radius
    Quaternion.slerp(raw, target, Math.sqrt(1. -. n *. n) *. gate)
  }
}
