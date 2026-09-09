// The 24 orientation-preserving rotations of a physical cube.  The group is
// generated from quarter turns rather than hand-maintained tables so every
// pose uses the same quaternion convention as the gyro pipeline.

let quarterTurn = Quaternion.degreesToRadians(90.)

let generators = [
  Quaternion.fromEuler({x: quarterTurn, y: 0., z: 0.}),
  Quaternion.fromEuler({x: 0., y: quarterTurn, z: 0.}),
  Quaternion.fromEuler({x: 0., y: 0., z: quarterTurn}),
]

let samePose = (a: Quaternion.t, b: Quaternion.t): bool => Quaternion.angle(a, b) < 0.00001

let poses = {
  let found = [Quaternion.identity]
  let next = ref(0)
  while next.contents < Array.length(found) {
    let pose = found->Array.getUnsafe(next.contents)
    next := next.contents + 1
    generators->Array.forEach(generator => {
      let candidate = Quaternion.multiply(pose, generator)->Quaternion.normalize
      if !(found->Array.some(existing => samePose(existing, candidate))) {
        found->Array.push(candidate)
      }
    })
  }
  found
}

let nearest = (
  raw: Quaternion.t,
  current: option<Quaternion.t>,
  marginRad: float,
): Quaternion.t => {
  let best = poses->Array.reduce(Quaternion.identity, (best, candidate) =>
    if Quaternion.angle(raw, candidate) < Quaternion.angle(raw, best) {
      candidate
    } else {
      best
    }
  )
  switch current {
  | Some(locked)
    if Quaternion.angle(raw, best) +. marginRad >= Quaternion.angle(raw, locked) => locked
  | _ => best
  }
}
