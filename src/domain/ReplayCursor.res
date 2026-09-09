// Pure virtual-clock cursor for any timestamp-ordered event sequence. It
// deliberately returns indices rather than importing a transport event type.

type state = {nextIndex: int, virtualNowMs: float}

let initial: state = {nextIndex: 0, virtualNowMs: 0.}

let position = state => state.nextIndex
let virtualNowMs = state => state.virtualNowMs
let done = (state, timestamps: array<float>) => state.nextIndex >= Array.length(timestamps)

let timestampBefore = (timestamps: array<float>, index: int): float =>
  if index <= 0 || Array.length(timestamps) == 0 {
    0.
  } else {
    timestamps->Array.getUnsafe(index - 1)
  }

/** Reset to an index; callers rebuild stateful consumers before using it to seek backwards. */
let seekTo = (timestamps: array<float>, index: int): state => {
  let bounded = if index < 0 {
    0
  } else {
    index
  }
  let nextIndex = if bounded > Array.length(timestamps) {
    Array.length(timestamps)
  } else {
    bounded
  }
  {nextIndex, virtualNowMs: timestampBefore(timestamps, nextIndex)}
}

/** Emit precisely one next index and advance virtual time to that event's timestamp. */
let stepOne = (state: state, timestamps: array<float>): (state, option<int>) =>
  if done(state, timestamps) {
    (state, None)
  } else {
    let index = state.nextIndex
    let timestamp = timestamps->Array.getUnsafe(index)
    ({nextIndex: index + 1, virtualNowMs: timestamp}, Some(index))
  }

/** Emit every index at or before `targetMs`. Virtual time never runs backwards. */
let advanceTo = (state: state, timestamps: array<float>, targetMs: float): (state, array<int>) => {
  let target = if targetMs < state.virtualNowMs {
    state.virtualNowMs
  } else {
    targetMs
  }
  let cursor = ref(state)
  let emitted = ref([])
  while (
    !done(cursor.contents, timestamps) &&
    timestamps->Array.getUnsafe(cursor.contents.nextIndex) <= target
  ) {
    let (next, index) = stepOne(cursor.contents, timestamps)
    cursor := next
    switch index {
    | Some(value) => emitted := [...emitted.contents, value]
    | None => ()
    }
  }
  ({...cursor.contents, virtualNowMs: target}, emitted.contents)
}

let reset = (_: state): state => initial
