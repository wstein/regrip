// Tracks the optional rolling MOVE/FACELETS serial supplied by protocols such
// as GAN. This is a pure packet-integrity guard, not a cube permutation
// reducer: callers request an authoritative snapshot when it detects a gap.

type gap = {previousSerial: int, serial: int, missing: int}
type state = {lastSerial: option<int>, untrusted: bool}

let initial: state = {lastSerial: None, untrusted: false}

let modulo = 256
let normalize = serial => (serial % modulo + modulo) % modulo

let trusted = state => !state.untrusted

/** Record an authoritative FACELETS serial and re-establish trust. */
let observeSnapshot = (_state: state, serial: option<int>): state =>
  switch serial {
  | Some(serial) => {lastSerial: Some(normalize(serial)), untrusted: false}
  // A serial-less FACELETS packet is still authoritative for the player. It
  // restores trust but makes the next serial-bearing MOVE a new baseline.
  | None => {lastSerial: None, untrusted: false}
  }

/**
 * Detect a forward discontinuity in an optional modulo-256 move serial.
 * Duplicates and stale/out-of-order values are ignored; one gap is emitted
 * until an authoritative serial-bearing snapshot restores trust.
 */
let observeMove = (state: state, serial: option<int>): (state, option<gap>) =>
  switch (state.lastSerial, serial) {
  | (_, None) => (state, None)
  | (None, Some(serial)) => ({...state, lastSerial: Some(normalize(serial))}, None)
  | (Some(previousSerial), Some(serial)) => {
      let serial = normalize(serial)
      let delta = (serial - previousSerial + modulo) % modulo
      if delta == 1 {
        ({...state, lastSerial: Some(serial)}, None)
      } else if delta == 0 || delta >= modulo / 2 {
        // Duplicate / stale data must not make a healthy stream untrusted.
        (state, None)
      } else if state.untrusted {
        ({...state, lastSerial: Some(serial)}, None)
      } else {
        (
          {lastSerial: Some(serial), untrusted: true},
          Some({previousSerial, serial, missing: delta - 1}),
        )
      }
    }
  }
