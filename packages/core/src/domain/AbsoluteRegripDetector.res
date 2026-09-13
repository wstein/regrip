// Absolute virtual-regrip detector over the 24 orientation-preserving cube
// poses. Unlike the rolling threshold detector, this reducer locks only near
// a valid cube orientation and plans a shortest sequence of exact quarters
// from the last emitted pose to that absolute target.

type config = {snapDeg: float, hysteresisDeg: float}
type observation = {
  sensorFrameToken: CubeNotation.regripToken,
  notationToken: CubeNotation.regripToken,
}

let defaults = {snapDeg: 35., hysteresisDeg: 6.}
let quarter = Quaternion.degreesToRadians(90.)

type transition = {
  rotation: Quaternion.t,
  sensorFrameToken: CubeNotation.regripToken,
  notationToken: CubeNotation.regripToken,
}

let positiveX = Quaternion.fromEuler({x: quarter, y: 0., z: 0.})
let positiveY = Quaternion.fromEuler({x: 0., y: quarter, z: 0.})
let positiveZ = Quaternion.fromEuler({x: 0., y: 0., z: quarter})

let transitions = [
  {
    rotation: positiveX,
    sensorFrameToken: CubeNotation.XTurn,
    notationToken: CubeNotation.XPrime,
  },
  {
    rotation: Quaternion.conjugate(positiveX),
    sensorFrameToken: CubeNotation.XPrime,
    notationToken: CubeNotation.XTurn,
  },
  {
    rotation: positiveY,
    sensorFrameToken: CubeNotation.YTurn,
    notationToken: CubeNotation.YPrime,
  },
  {
    rotation: Quaternion.conjugate(positiveY),
    sensorFrameToken: CubeNotation.YPrime,
    notationToken: CubeNotation.YTurn,
  },
  {
    rotation: positiveZ,
    sensorFrameToken: CubeNotation.ZTurn,
    notationToken: CubeNotation.ZPrime,
  },
  {
    rotation: Quaternion.conjugate(positiveZ),
    sensorFrameToken: CubeNotation.ZPrime,
    notationToken: CubeNotation.ZTurn,
  },
]

type state = {
  lockedPose: Quaternion.t,
  emittedPose: Quaternion.t,
  pending: array<transition>,
}

let initial = {
  lockedPose: Quaternion.identity,
  emittedPose: Quaternion.identity,
  pending: [],
}

let pose = (state: state): Quaternion.t => state.emittedPose
let samePose = (a: Quaternion.t, b: Quaternion.t): bool => Quaternion.angle(a, b) < 0.00001

type searchNode = {pose: Quaternion.t, path: array<transition>}

let shortestPath = (fromPose: Quaternion.t, toPose: Quaternion.t): array<transition> => {
  if samePose(fromPose, toPose) {
    []
  } else {
    let queue = [{pose: fromPose, path: []}]
    let visited = [fromPose]
    let cursor = ref(0)
    let result = ref(None)

    while cursor.contents < Array.length(queue) && Option.isNone(result.contents) {
      let node = queue->Array.getUnsafe(cursor.contents)
      cursor := cursor.contents + 1
      transitions->Array.forEach(transition => {
        if Option.isNone(result.contents) {
          let candidate = Quaternion.multiply(node.pose, transition.rotation)->Quaternion.normalize
          if !(visited->Array.some(existing => samePose(existing, candidate))) {
            let path = Array.concat(node.path, [transition])
            if samePose(candidate, toPose) {
              result := Some(path)
            } else {
              visited->Array.push(candidate)
              queue->Array.push({pose: candidate, path})
            }
          }
        }
      })
    }

    switch result.contents {
    | Some(path) => path
    | None => failwith("cube orientation graph must be connected")
    }
  }
}

let emitNext = (state: state): (state, option<observation>) =>
  switch state.pending->Array.get(0) {
  | None => (state, None)
  | Some(transition) => (
      {
        ...state,
        emittedPose: Quaternion.multiply(
          state.emittedPose,
          transition.rotation,
        )->Quaternion.normalize,
        pending: state.pending->Array.slice(~start=1),
      },
      Some({
        sensorFrameToken: transition.sensorFrameToken,
        notationToken: transition.notationToken,
      }),
    )
  }

let step = (state: state, raw: Quaternion.t, ~config=defaults): (state, option<observation>) => {
  let raw = Quaternion.normalize(raw)
  let candidate = CubeSymmetry.nearest(
    raw,
    Some(state.lockedPose),
    Quaternion.degreesToRadians(config.hysteresisDeg),
  )
  let isSettled = Quaternion.angle(raw, candidate) <= Quaternion.degreesToRadians(config.snapDeg)

  if !isSettled {
    (state, None)
  } else if samePose(candidate, state.lockedPose) {
    emitNext(state)
  } else {
    emitNext({
      lockedPose: candidate,
      emittedPose: state.emittedPose,
      pending: shortestPath(state.emittedPose, candidate),
    })
  }
}
