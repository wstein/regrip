# Repository Guidelines

## Project Structure & Module Organization

- `packages/core/src/domain/` contains pure ReScript reducers and cube math. Keep it deterministic: no DOM, renderer, Bluetooth effects, clocks, or Signals.
- `packages/core/src/session/` owns the portable smart-cube lifecycle, profiles, replay, and typed transport boundary.
- `src/app/` owns DOM, Preact Signals, controls, trace UI, and composition. `src/integration/` applies session output to app concerns; `src/adapters/` contains cubing.js and Three.js bridges.
- Browser tests live in `test/browser/`; unit tests sit beside source as `*.test.ts`. ReScript tests use `*_test.res`.
- Do not commit device captures. Local `smartcube-log-*.jsonl`, generated `dist/`, and `bun.lock` are ignored; npm and `package-lock.json` are the supported package workflow.

## Build, Test, and Development Commands

- `npm install` installs the workspace dependencies.
- `npm run dev` starts ReScript watch and the Vite lab.
- `npm test` builds ReScript, then runs separate core and app Vitest suites.
- `npm run build` runs the core/app type builds and production Vite build.
- `npm run lint` enforces TypeScript boundaries; `npm run format:check` checks ReScript and Prettier formatting.
- `npm run test:browser` runs Playwright. Use `npm run test:screenshots` for visual baseline checks.
- `npm run core:pack:check` validates the packed `@wstein/regrip-core` artifact with isolated TypeScript and ReScript consumers.

## Coding Style & Naming Conventions

Use TypeScript with strict types and ReScript for domain reducers. Let Prettier and `rescript format` decide whitespace; do not hand-format generated `*.res.mjs` files. Prefer descriptive camelCase functions, PascalCase types, and focused modules. Reducers should follow `(state, input) -> (nextState, effects)`; keep renderer and transport effects at the outer layers.

## Testing Guidelines

Add a colocated test for behavior changes. Use deterministic timestamps and fixtures for session/replay work; test hardware-specific behavior through mock transports before real-cube validation. Update Playwright screenshots intentionally with `npm run test:screenshots:update` only after reviewing the visual difference.

## Commit & Pull Request Guidelines

Use Conventional Commits, e.g. `fix(trace): preserve requested snapshots`; headers must be at most 100 characters. Keep commits focused. PRs need a user-facing summary, verification commands, linked context where applicable, and screenshots for UI/rendering changes. Never include MAC addresses, credentials, or unredacted captures.
