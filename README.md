# smartcube-example

[![CI](https://github.com/wstein/smartcube-example/actions/workflows/ci.yml/badge.svg)](https://github.com/wstein/smartcube-example/actions/workflows/ci.yml)
[![Pages](https://github.com/wstein/smartcube-example/actions/workflows/pages.yml/badge.svg)](https://github.com/wstein/smartcube-example/actions/workflows/pages.yml)
[![Live demo](https://img.shields.io/badge/demo-live-brightgreen)](https://wstein.github.io/smartcube-example/)
[![ReScript](https://img.shields.io/badge/ReScript-12-e84f4f?logo=rescript&logoColor=white)](https://rescript-lang.org)
[![Web Bluetooth](https://img.shields.io/badge/Web_Bluetooth-enabled-0082fc?logo=bluetooth&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE.txt)

A single-page [Vite](https://vite.dev) example for the
[Generic Smart Cube API](https://github.com/wstein/smartcube-web-bluetooth). It uses Web Bluetooth
to auto-detect supported GAN, Giiker, GoCube, MoYu, and QiYi cubes, displays a cubing.js
`TwistyPlayer`, and provides a basic solve timer with gyro orientation.

The dependency is pinned to a tested `smartcube-web-bluetooth` commit. Update it deliberately, run
the checks below, and commit the resulting lockfile change together with the package change.

## What the panel shows

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

`src/app/index.ts` is the composition root: it mounts the player, wires controls, and coordinates the
connection lifecycle. Imports flow downward from `app` to `adapters`, `session`, and `domain`; ESLint
enforces that `domain` stays independent and `session` does not depend on presentation layers.

| Module                                           | Responsibility                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `src/app/`                                       | DOM panel, styles, and composition root                              |
| `src/session/connection.ts` / `cubeEvents.ts`    | Generic connection plus headless event/timer orchestration           |
| `src/session/timerController.ts` / `cubeInfo.ts` | Timer effects, clock/skew handling, and protocol-metadata formatting |
| `src/adapters/cubing/`                           | cubing.js scramble solver, facelet bridge, and TwistyPlayer          |
| `src/adapters/three/`                            | Three.js render loop                                                 |
| `src/domain/`                                    | Pure ReScript state, timing, facelet, and orientation logic          |

The core domain logic is [ReScript](https://rescript-lang.org), compiled in-source to `*.res.mjs`:

| Module                                              | Responsibility                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/domain/CubeFacelets.res`                       | Facelet string ⇄ KPatternData conversion                                 |
| `src/domain/Timer.res` / `Time.res`                 | Pure solve-timer state machine and `m:ss.mmm` formatting                 |
| `src/domain/MoveBuffer.res`                         | Pure rolling recent-move and solution buffers                            |
| `src/domain/Quaternion.res` / `GyroOrientation.res` | Three.js-compatible gyro orientation math                                |
| `src/session/Bindings_SmartCube.res`                | Typed boundary for timestamp helper functions from the Bluetooth library |

Hand-written `*.res.d.mts` files define the TypeScript boundary for those compiled ReScript modules.

## Development

```sh
npm install
npm run dev      # ReScript watch + Vite dev server
npm test         # Compile ReScript and run Vitest specs
npm run build    # ReScript + TypeScript + production Vite build
npm run lint     # Enforce layer import boundaries
```
