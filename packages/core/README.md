# @wstein/regrip-core

Portable MIT smart-cube core shared by the Regrip browser lab and CubeLab. It is a workspace
source package today (`file:packages/core`), not a published npm package.

## Consumer surface

| Import family                                  | Purpose                                                       |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `@wstein/regrip-core/domain/*.res.mjs`         | Pure ReScript cube, gyro, regrip, timing, and replay reducers |
| `@wstein/regrip-core/session/smartCubeSession` | Headless connection lifecycle and ordered typed event stream  |
| `@wstein/regrip-core/session/features`         | Feature defaults, presets, and runtime patches                |
| `@wstein/regrip-core/session/profile/*`        | Profile resolution and profile types                          |
| `@wstein/regrip-core/session/replay/*`         | Deterministic JSONL replay transport and fixtures             |
| `@wstein/regrip-core/bindings/*`               | Typed BLE-library boundary; internal unless a host needs it   |

The package uses in-source ReScript compilation. Every public ReScript module has a hand-maintained
`.res.d.mts` declaration boundary; `npm run check:declarations` verifies its exports and arities.

## Rules for consumers

- Supply `smartcube-web-bluetooth` and `rxjs` as peer dependencies when using the session layer.
- Keep browser DOM, renderer, and application state outside this package.
- Feed the session typed smart-cube connections and subscribe to its ordered event stream; do not
  recreate protocol decoders in a host.
- Treat profile and feature configuration as runtime data, not compile-time event type narrowing.

See the repository [architecture guide](../../ARCHITECTURE.md) for layer and frame semantics.
