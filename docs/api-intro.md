# API reference

This reference is generated from `@wstein/regrip-core`'s TypeScript boundary and is organized into
three groups:

- **domain** — pure ReScript reducers and cube math (gyro orientation, regrip detection, facelet
  decoding, move tracking). Deterministic: no DOM, renderer, Bluetooth effects, clocks, or Signals.
  Exposed here through their generated `.gen.ts` wrappers.
- **session** — the portable smart-cube lifecycle: profiles, replay, and the typed transport
  boundary that composes the domain reducers into a running session.
- **bindings** — the typed boundary to the `smartcube-web-bluetooth` package itself.

See the [project overview](/) for how these fit into the Console app, or the
[coverage report](/coverage/) for how thoroughly each area is tested.
