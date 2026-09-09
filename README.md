# Regrip

[![CI](https://github.com/wstein/regrip/actions/workflows/ci.yml/badge.svg)](https://github.com/wstein/regrip/actions/workflows/ci.yml)
[![Pages](https://github.com/wstein/regrip/actions/workflows/pages.yml/badge.svg)](https://github.com/wstein/regrip/actions/workflows/pages.yml)
[![Live demo](https://img.shields.io/badge/demo-live-brightgreen)](https://wstein.github.io/regrip/)
[![ReScript](https://img.shields.io/badge/ReScript-12-e84f4f?logo=rescript&logoColor=white)](https://rescript-lang.org)
[![Web Bluetooth](https://img.shields.io/badge/Web_Bluetooth-enabled-0082fc?logo=bluetooth&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A single-page [Vite](https://vite.dev) example for the
[Generic Smart Cube API](https://github.com/wstein/smartcube-web-bluetooth). It uses Web Bluetooth
to auto-detect supported GAN, Giiker, GoCube, MoYu, and QiYi cubes, displays a cubing.js
`TwistyPlayer`, and provides a basic solve timer with gyro orientation.

## Highlights

- A session-owned Bluetooth lifecycle with connection status, initial-state requests, safe teardown,
  and profile resolution.
- Per-model profiles for stabilization, gyro axes, battery presentation, and protocol quirks.
- Pure ReScript magnetic gyro stabilization: cube-symmetry detents, hysteresis, velocity gating,
  and a configurable drift adjustment.
- Virtual `x`, `y`, and `z` regrips from calibrated gyro poses. Face moves and the R/U/F orientation
  gizmo stay in the current virtual cube frame.

### Coordinate frames

The app keeps protocol and user notation deliberately separate:

| Frame  | Purpose                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------- |
| Sensor | Raw BLE quaternion from the IMU die.                                                                  |
| Body   | Cube shell: protocol `MOVE`/`FACELETS` values and URFDLB labels.                                      |
| World  | Calibrated gyro pose used only for regrip detection and rendering.                                    |
| Solver | User-facing white-up/green-front notation, maintained as an exact integer solver-to-body permutation. |
| Scene  | Renderer home pose applied after the world-relative gyro pose.                                        |

`SensorToBody` is a fixed per-model axis convention; `GyroOrientation` then captures a per-session
body-to-world basis. World quaternions never translate moves or facelets: those use `VirtualCubeFrame`'s
integer Body↔Solver mapping, updated only by detected `x/y/z` regrips.

- A 300 ms returned-face custom trigger (`R R'`, for example), detected independently of the gyro
  magnet layer.
- Editable detected moves, cube state, solve timer, JSONL recording, and a local live event trace.
  The trace supports filters, sort direction, fixed JSON detail, selection, copy/export, and replay
  of selected moves.
- A capability-gated command panel: state/battery/hardware refresh plus supported vendor controls.
  GoCube controls include backlight actions, gyro calibration, orientation enablement, and confirmed
  reboot; every command result is recorded in the local trace and JSONL capture.

The dependency is pinned to a tested `smartcube-web-bluetooth` commit. Update it deliberately, run
the checks below, and commit the resulting lockfile change together with the package change.

## Cube information and hardware notes

- Connection state, selected protocol, capabilities, device and hardware details, and battery level.
- Standard `MOVE`, `FACELETS`, `GYRO`, `HARDWARE`, `BATTERY`, and `DISCONNECT` events.
- Optional protocol metadata only when it is supplied: GAN serial/cubie state, GoCube center
  orientation, model type, and Edge offline statistics.
- Clock skew for cubes that expose a cube timestamp. GoCube does not, so its solve time remains the
  locally measured elapsed time and its skew field reports that a cube clock is unavailable.

Some encrypted cube protocols require a MAC address. If automatic advertisement watching is not
available, the app prompts for one and explains how to enable
`chrome://flags/#enable-experimental-web-platform-features` in Chrome.

## Architecture

`src/app/index.ts` is the composition root: it mounts the player and DOM controls. Imports flow
downward from `app` to `adapters`, `session`, and `domain`; ESLint enforces that `domain` stays
independent and `session` does not depend on presentation layers.

| Module                            | Responsibility                                                            |
| --------------------------------- | ------------------------------------------------------------------------- |
| `src/app/`                        | DOM, trace/JSONL tooling, styles, and composition root                    |
| `src/session/smartCubeSession.ts` | Headless lifecycle, calibrated event stream, regrips, and custom triggers |
| `src/session/profile/`            | Profile inheritance, matching, overrides, and per-field provenance        |
| `src/session/virtualMoveFrame.ts` | Thin TypeScript adapter for the domain virtual cube frame                 |
| `src/session/timerController.ts`  | Timer effects; `cubeInfo.ts` formats clock/skew and protocol metadata     |
| `src/adapters/cubing/`            | cubing.js scramble solver, facelet bridge, and TwistyPlayer               |
| `src/adapters/three/`             | Three.js scene, orientation render loop, and R/U/F gizmo                  |
| `src/domain/`                     | Pure ReScript cube, timing, trigger, quaternion, and stabilization logic  |

The core domain logic is [ReScript](https://rescript-lang.org), compiled in-source to `*.res.mjs`:

| Module                                                                                     | Responsibility                                                                    |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `Cube333.res` / `CubeFacelets.res`                                                         | Pure solved-state detection and facelet conversion                                |
| `Timer.res` / `Time.res` / `MoveBuffer.res`                                                | Solve-timer state machine, formatting, and recent-move buffers                    |
| `Quaternion.res` / `CubeSymmetry.res`                                                      | Quaternion math and the 24 cube orientations                                      |
| `MagneticDetent.res` / `OrientationStabilizer.res` / `GyroOrientation.res`                 | Detents, hysteresis, velocity gating, drift, and calibrated poses                 |
| `SensorToBody.res` / `RegripDetector.res` / `VirtualCubeFrame.res` / `MoveBackTrigger.res` | Sensor axes, virtual rotations, Body↔Solver remapping, and returned-face triggers |
| `src/bindings/Bindings_SmartCube.res`                                                      | Typed timestamp-helper boundary to the Bluetooth library                          |

Hand-written `*.res.d.mts` files define the TypeScript boundary for those compiled ReScript modules.

## Development

```sh
npm install
npm run dev      # ReScript watch + Vite dev server
npm test         # Compile ReScript and run Vitest specs
npm run test:snapshot # Refresh the deterministic JSONL session-contract snapshot
npm run test:browser  # Run Chromium coverage for the WebGL orientation gizmo
npm run build    # ReScript + TypeScript + production Vite build
npm run lint     # Enforce layer import boundaries
npm run format    # Format ReScript and all supported text sources
npm run docs:api # Generate TypeDoc to docs/api/
```

The JSONL replay fixture is deliberately synthetic and redacted. Do not commit unreviewed hardware
captures: exported logs can contain device and session data.

Vite DevTools is development-only and starts in passive mode. Use `⇧⌥D` on macOS to reveal it.

## API documentation

Run `npm run docs:api`, then visit
[`http://localhost:5173/docs/api/index.html`](http://localhost:5173/docs/api/index.html) while the
dev server is running. Before generation, that route provides a fallback page with the local commands.

GitHub Pages generates and serves the same reference at
[`/regrip/docs/api/index.html`](https://wstein.github.io/regrip/docs/api/index.html).
For source-native ReScript documentation JSON, use:

```sh
npx rescript-tools doc src/domain/Quaternion.resi
```

## Community

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Report security issues according to [SECURITY.md](SECURITY.md), not in a public issue.
