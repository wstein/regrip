# Regrip architecture

Regrip separates deterministic smart-cube behavior from browser presentation. A captured JSONL
event stream must be replayable through the same session and reducer chain that handled it live.

## Workspace layout

```
packages/core/src/domain/       Pure ReScript reducers and cube math
packages/core/src/bindings/     Typed boundary to smartcube-web-bluetooth
packages/core/src/session/      Portable, headless connection lifecycle and replay
src/adapters/                   cubing.js and Three.js host adapters
src/integration/                Browser-lab effects: events, timer, export, connection chooser
src/app/                        DOM, signals, styles, and composition root
```

`@wstein/regrip-core` is the reusable MIT core consumed by this lab and CubeLab. The lab never
owns Bluetooth decoding or gyro/regrip math; it composes the core with browser-specific rendering
and controls.

## Dependency rules

The portable core cannot import the lab. In particular:

- `packages/core/src/domain/` is pure deterministic math: no DOM, Bluetooth, renderer, clock, or
  framework dependencies.
- `packages/core/src/session/` owns the headless lifecycle and may use core bindings/domain code,
  but cannot reach `src/app`, `src/adapters`, or `src/integration`.
- `src/app/` is the only Signals/DOM layer.
- `src/integration/` applies core events and reducer effects to the lab; `src/adapters/` bridges
  cubing.js and Three.js.

`npm run lint` checks TypeScript in both `src/` and `packages/core/src/`; lint-staged does the
same for changed files. The path rules and Signals ban are therefore CI enforcement, not a
code-review convention. ReScript compilation and its paired reducer tests enforce the remaining
domain boundary.

## Deterministic data flow

```
BLE hardware or JSONL replay
          │ typed SmartCubeEvent, recorded timestamps
          ▼
@wstein/regrip-core/session
          │ ordered session events and feature/profile state
          ▼
src/integration + core domain reducers
          │ player effects, timer effects, display state
          ▼
src/app + src/adapters

BLE decoder diagnostics (optional)
          │ SmartCubeDiagnosticEvent
          ▼
session.subscribeDiagnostics() ─────────────► src/app live trace only
```

Domain reducers receive timestamps as data rather than calling `Date.now()`. That makes a JSONL
replay deterministic: the same source events produce the same feature decisions, virtual regrips,
and timer values. The browser timer display uses a replay virtual clock when replay is active.

### Diagnostic boundary

`SmartCubeDiagnosticEvent` is deliberately not a `SmartCubeSessionEvent`. It carries packet-level
decoder evidence (`RAW_PACKET`, `DECODED_PACKET`, `MALFORMED_PACKET`, or `UNKNOWN_PACKET`) for the
default-off Diagnostic trace filter. The core subscribes and exposes it on a separate observer
channel, but never routes it through cube-state reducers, trigger detectors, or the normal JSONL
replay capture. The app bounds this separate buffer and displayed byte payload, so a noisy decoder
cannot displace moves or snapshots from the session record.

Encrypted protocol implementations may emit decoded packet evidence but must not emit wire
ciphertext. Plaintext protocol diagnostics can include raw frames where that is useful for decoder
investigation.

## Frames

| Frame  | Fixed to      | Used for                                              |
| ------ | ------------- | ----------------------------------------------------- |
| Sensor | IMU die       | Raw BLE quaternion                                    |
| Body   | Cube shell    | Protocol `MOVE` and `FACELETS` values                 |
| World  | Room/gravity  | Stabilization, regrip detection, rendered pose        |
| Solver | User notation | Exact integer Body↔Solver move and facelet projection |
| Scene  | Renderer      | Three.js home pose                                    |

`SensorToBody` is a fixed profile axis convention. `GyroOrientation` captures the session basis;
`VirtualCubeFrame` separately tracks exact solver-to-body permutations. World quaternion math
never rewrites notation or facelets, avoiding float drift in the user-facing solver frame.

## Regrip confidence

`RegripDetector` is frame-agnostic and emits cube-body `x`/`y`/`z` tokens. It advances its ratchet
only when the nearest cardinal quarter turn strictly improves the current residual and leaves it
inside the configured acceptance region. This rejects diagonal calibration dead zones and ambiguous
large rotations instead of alternating regrips forever; the app projects accepted body tokens into
the solver frame for display.

## Reducer pattern

Core state machines follow the `Timer.res` / `PlayerSync.res` shape:

```
(state, input) -> (nextState, effects)
```

Effects are data (`AddMove`, `SetAlgorithm`, and so on), not DOM or renderer calls. The portable
session and lab integration execute them. This makes packet gaps, snapshot races, regrip detection,
and replay fixtures small, isolated tests.

## Useful references

- [packages/core/README.md](packages/core/README.md) — core consumer surface
- [README.md](README.md) — lab setup and event-pipeline overview
- `packages/core/src/domain/Timer.res` — canonical reducer style
- `packages/core/src/session/jsonlMock.e2e.test.ts` — JSONL replay at the connection boundary
- `eslint.config.js` — checked TypeScript import boundaries
- [David Singmaster's cycle-notation discussion (PDF)](https://maths-people.anu.edu.au/~burkej/cube/singmaster.pdf) —
  the reference for the compact cubie-cycle display.
- [cube-notation-compiler](https://github.com/Afront/cube-notation-compiler) —
  an Extended Singmaster notation grammar and compiler reference.
- [CubeTwister Superset ENG 3×3 notation](https://www.randelshofer.ch/cubetwister/doc/notations/superset_eng_3x3.html) —
  the reference for Copy as SSE permutation cycles.
- [Superset ENG 3×3 move notation](https://www.randelshofer.ch/rubik/patterns/doc/supersetENG_3x3.html) —
  the reference for Copy SSE detected moves.
- [WCA Regulations, Article 12: Notation](https://www.worldcubeassociation.org/regulations/#article-12-notation) —
  the reference for the WCA detected-move editor view.
- [CubeTwister / TWIZZLE description](https://www.randelshofer.ch/cube/twister/doc/description.php) —
  the reference for the Twizzle detected-move editor view.
