# Repository Guidelines

## Project Structure & Module Organization

- `packages/core/src/domain/` contains pure ReScript reducers and cube math. Keep it deterministic: no DOM, renderer, Bluetooth effects, clocks, or Signals.
- `packages/core/src/session/` owns the portable smart-cube lifecycle, profiles, replay, and typed transport boundary. `packages/core/src/bindings/` is the typed boundary to `smartcube-web-bluetooth` itself; `packages/core/src/profiles/` holds the per-device JSON profiles and their schema.
- `src/app/` owns DOM, Preact Signals, controls, trace UI, and composition. `src/integration/` applies session output to app concerns; `src/adapters/` contains cubing.js and Three.js bridges.
- Three separate Vite HTML entry points exist at the repo root: `index.html` (the lab app), `landing.html`, and `docs.html` (narrative docs; the generated TypeDoc API reference is separately served under `docs/api/`). See `vite.config.ts`'s `rollupOptions.input`.
- Browser tests live in `test/browser/`; unit tests sit beside source as `*.test.ts` (files named `*.browser.test.ts` run under jsdom via a `// @vitest-environment jsdom` pragma). ReScript tests use `*_test.res`.
- You can exercise the full app without physical hardware: `npm run dev`, then open `/test/browser/mock-app.html?replay&fixture=gocube-edge` (or `gan-ui12`, or `local` after using **Load JSONL**) to replay a recorded fixture through the real session and UI. Add `&autoplay` to advance it immediately, or `&feed=session` to replay session-output instead of the connection feed.
- Do not commit device captures. Local `smartcube-log-*.jsonl`, generated `dist/`, and `bun.lock` are ignored; npm and `package-lock.json` are the supported package workflow.

## Build, Test, and Development Commands

- `npm install` installs the workspace dependencies.
- `npm run dev` starts ReScript watch and the Vite lab.
- `npm test` builds ReScript, then runs separate core and app Vitest suites.
- `npm run build` runs the core/app type builds and production Vite build.
- `npm run lint` enforces TypeScript boundaries; `npm run format:check` checks ReScript and Prettier formatting.
- `npm run test:browser` runs Playwright. Use `npm run test:screenshots` for visual baseline checks.
- `npm run core:pack:check` validates the packed `@wstein/regrip-core` artifact with isolated TypeScript and ReScript consumers.
- To run a single test, build ReScript first (`npm run res:build` — a bare `vitest` invocation does not do this for you), then target the right one of the two split Vitest configs by file path:
  `npx vitest run --config vitest.config.ts src/app/commandPanel.browser.test.ts` (app-level, `src/`) or
  `npx vitest run --config packages/core/vitest.config.ts packages/core/src/domain/RegripDetector_test.res.mjs` (core-level, `packages/core/src/`). Add `-t "<name>"` to filter by test name.

## Coding Style & Naming Conventions

Use TypeScript with strict types and ReScript for domain reducers. Let Prettier and `rescript format` decide whitespace; do not hand-format generated `*.res.mjs` files. Prefer descriptive camelCase functions, PascalCase types, and focused modules. Reducers should follow `(state, input) -> (nextState, effects)`; keep renderer and transport effects at the outer layers.

## Testing Guidelines

Add a colocated test for behavior changes. Use deterministic timestamps and fixtures for session/replay work; test hardware-specific behavior through mock transports before real-cube validation. Update Playwright screenshots intentionally with `npm run test:screenshots:update` only after reviewing the visual difference.

**TDD method — prove the test before trusting the fix.** For a bug fix: write (or extend) the test to express the correct behavior, confirm it actually fails against the current code, then implement the fix and confirm it now passes. A test that was only ever run against passing code hasn't verified anything. Concretely: apply the fix, run the test, then temporarily revert just the fix (not the test) and rerun it — it must fail before you restore the fix and commit both together. For a new ReScript module, write `*_test.res` against the not-yet-implemented API first and watch it fail to compile/run before implementing. Ship the test and the change in the same commit; don't split "add test" and "make it pass" across separate commits unless the change is a large, multi-commit module port.

## Commit & Pull Request Guidelines

Use Conventional Commits, e.g. `fix(trace): preserve requested snapshots`; headers must be at most 100 characters. Keep commits focused. PRs need a user-facing summary, verification commands, linked context where applicable, and screenshots for UI/rendering changes. Never include MAC addresses, credentials, or unredacted captures.
