# @wstein/regrip-core

Portable MIT smart-cube core shared by the Regrip browser lab and CubeLab. The root repository is
private application tooling; this package is its publishable artifact.

## Install

```sh
npm install @wstein/regrip-core rxjs smartcube-web-bluetooth
```

`rxjs` and `smartcube-web-bluetooth` are peer dependencies. Installing them explicitly lets the
host control the transport version and keeps one observable implementation in the application.

## Consumer surface

| Import family                                  | Purpose                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `@wstein/regrip-core/domain/<Module>`          | Generated TypeScript boundary for pure cube, gyro, regrip, timing, and replay reducers |
| `@wstein/regrip-core/session/smartCubeSession` | Headless connection lifecycle and ordered typed event stream                           |
| `@wstein/regrip-core/session/features`         | Feature defaults, presets, and runtime patches                                         |
| `@wstein/regrip-core/session/profile/*`        | Profile resolution and profile types                                                   |
| `@wstein/regrip-core/session/replay/*`         | Deterministic JSONL replay transport and fixtures                                      |
| `@wstein/regrip-core/bindings/*`               | Typed BLE-library boundary; internal unless a host needs it                            |

The package uses in-source ReScript compilation. genType derives a `*.gen.ts` wrapper for every
public ReScript interface, so TypeScript declarations stay coupled to the ReScript source.

### ReScript-derived names

Generated exports preserve the lower-case names from ReScript interfaces. For example, use
`t` from `domain/Quaternion`, `state` from `domain/Timer`, and `regripToken` from
`domain/CubeNotation`. TypeScript consumers can alias them at import time when a PascalCase local
name reads better:

```ts
import { identity, type t as Quaternion } from '@wstein/regrip-core/domain/Quaternion';
```

The former `*.res.mjs` subpaths are internal runtime dependencies and are no longer public imports.

## Rules for consumers

- Supply `smartcube-web-bluetooth` and `rxjs` as peer dependencies when using the session layer.
- Keep browser DOM, renderer, and application state outside this package.
- Feed the session typed smart-cube connections and subscribe to its ordered event stream; do not
  recreate protocol decoders in a host.
- Treat profile and feature configuration as runtime data, not compile-time event type narrowing.

See the repository [architecture guide](../../ARCHITECTURE.md) for layer and frame semantics. The
release check builds the package, inspects `npm pack`, and compiles both TypeScript and ReScript
imports from an unpacked tarball consumer fixture.
