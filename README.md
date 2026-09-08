# smartcube-example

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

`src/index.ts` is the composition root: it mounts the player, wires controls, and coordinates the
connection lifecycle. Event, timer, render, and panel concerns are separate TypeScript modules.

| Module | Responsibility |
|---|---|
| `src/connection.ts` | Generic API connection, initial requests, and safe disconnect |
| `src/cubeEvents.ts` | Exhaustive Smart Cube event handling, initial facelet state, gyro and metadata presentation |
| `src/timerController.ts` | Timer state-machine effects, local clock, move buffering, skew, and clockless-cube handling |
| `src/sceneView.ts` / `src/twistyPlayer.ts` | Three.js render loop and cubing.js player setup |
| `src/infoPanel.ts` / `src/cubeInfo.ts` | DOM panel operations and protocol-metadata formatting |
| `src/constants.ts` | Shared solved facelet state |

The core domain logic is [ReScript](https://rescript-lang.org), compiled in-source to `*.res.mjs`:

| Module | Responsibility |
|---|---|
| `src/CubeFacelets.res` | Facelet string ⇄ KPatternData conversion |
| `src/Timer.res` / `src/Time.res` | Pure solve-timer state machine and `m:ss.mmm` formatting |
| `src/MoveBuffer.res` | Pure rolling recent-move and solution buffers |
| `src/Quaternion.res` / `src/GyroOrientation.res` | Three.js-compatible gyro orientation math |
| `src/Bindings_SmartCube.res` | Typed boundary for timestamp helper functions from the Bluetooth library |

Hand-written `*.res.d.mts` files define the TypeScript boundary for those compiled ReScript modules.

## Development

```sh
npm install
npm run dev      # ReScript watch + Vite dev server
npm test         # Compile ReScript and run Vitest specs
npm run build    # ReScript + TypeScript + production Vite build
```
