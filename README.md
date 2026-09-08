## smartcube-example

A single-page demo for the [smartcube-web-bluetooth](https://github.com/wstein/smartcube-web-bluetooth)
library. It uses the Generic Smart Cube API, which auto-detects and connects to supported GAN, Giiker,
GoCube, MoYu, and QiYi smart cubes over Web Bluetooth, and shows an approach to proper solve-time
measurement and gyroscope handling.

If the browser cannot determine the cube's MAC address automatically (needed to derive some cubes'
encryption keys), the app prompts for it — enable
`chrome://flags/#enable-experimental-web-platform-features` or enter the address manually.

### Architecture

The core logic is written in [ReScript](https://rescript-lang.org) and compiled to ES modules
alongside the sources:

| Module | Responsibility |
|---|---|
| `src/CubeFacelets.res` | facelets string ⇄ KPatternData conversion |
| `src/Timer.res` / `src/Time.res` | solve-timer state machine and `m:ss.mmm` formatting |
| `src/MoveBuffer.res` | rolling recent-move window + current solution moves |
| `src/Quaternion.res` / `src/GyroOrientation.res` | gyro orientation math (three.js-compatible) |

`src/index.ts` stays TypeScript and holds the GUI: jQuery DOM wiring, the cubing.js `TwistyPlayer`,
the three.js render loop, and the Bluetooth connect flow.

### Development

```
npm install
npm run dev      # rescript watch + vite dev server
npm test         # compile ReScript, run the vitest specs
npm run build    # rescript + tsc + vite build
```

ReScript compiles in-source to `*.res.mjs` (git-ignored); hand-written `*.res.d.mts` files type the
boundary consumed by `index.ts`.
