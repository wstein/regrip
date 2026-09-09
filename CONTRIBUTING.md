# Contributing

Thanks for improving smartcube-example. Small, focused changes with a clear hardware or browser
test result are especially valuable.

## Before you start

- Search existing issues and pull requests before opening a new one.
- Keep Bluetooth captures private. Redact device names, MAC addresses, serial numbers, and any
  other identifying metadata before attaching a JSONL trace.
- Discuss broad protocol, dependency, or architecture changes in an issue before implementing
  them.

## Local setup

```sh
npm install
npm run dev
```

Run the full local gate before opening a pull request:

```sh
npm run format:check
npm run lint
npm run test
npm run build
```

Use `npm run format` to apply ReScript and Prettier formatting, and `npm run docs:api` to preview
the generated TypeScript API reference.

## Project boundaries

Keep dependencies flowing downward:

```text
app → adapters → session → domain
```

- `src/domain/` is pure ReScript and must not depend on browser, Bluetooth, rendering, or session
  code.
- `src/session/` owns smart-cube lifecycle and event orchestration.
- `src/adapters/` integrates optional libraries such as Three.js and cubing.js.
- `src/app/` owns the demo UI and browser-specific behavior.

ESLint enforces the layer boundaries for TypeScript. Add deterministic unit coverage for domain
and session behavior; include a browser or hardware smoke-test note when changing rendering or
Bluetooth behavior.

## Pull requests

- Use focused conventional commits, for example `fix: correct GoCube battery display`.
- Explain the user-visible behavior, protocol impact, and verification in the PR description.
- Do not commit generated `*.res.mjs`, `*.res.d.mts`, `docs/api/`, build output, or device logs.
- Update the README or TODO when behavior, architecture, or remaining work changes.

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
