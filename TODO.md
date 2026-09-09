# Remaining topics

## Immediate delivery

- [ ] Push verified local `main` to `wstein/smartcube-example`, then close or
      rebase the stale Vitest-5 and ESLint-10 Dependabot PRs. They are known
      incompatible with `rescript-vitest@3` and `eslint-plugin-import@2`.
- [ ] Confirm the first `main` CI run and GitHub Pages deployment are green
      after the push; enable Pages' “GitHub Actions” source if required.

## Validate on real cubes

- [ ] Smoke-tune GoCube and GAN profiles: `radiusDeg`, `snapDeg`,
      `hysteresisDeg`, `velocityMax`, and `driftDegPerSec`.
- [x] Validate virtual x/y/z regrips and the R/U/F gizmo against captured and
      live hardware sessions, including mixed-axis and quick reversal handling.
- [ ] Tune or make configurable the 300 ms returned-face `CUSTOM_TRIGGER`
      window after real-cube testing.

## Product/UI

- [x] Add a visible move counter and promote the active solve timer near the
      move editor.
- [ ] Decide whether Device Info should be collapsible on compact screens.
- [ ] Consider a decoded cube-state presentation (2D net or concise summary)
      instead of raw CP/CO/EP/EO text.
- [ ] Decide whether detected moves need an optional chip/badge view in
      addition to the editable solver-friendly text field.
- [x] Add user-facing feedback for Copy, Reset State confirmation, and custom
      move triggers.
- [x] Add local-only live-trace selection: range/type selection, fixed detail
      pane, JSONL download/copy, and local replay of selected `MOVE` events.
- [x] Add capability-gated universal and vendor cube commands, with confirmed
      reboot and local trace/JSONL result feedback.
- [ ] Decide whether a selected trace's replay should append to the current
      player state as an alternative to replacing its algorithm.
- [ ] Do not add Gist, Pastebin, or other trace-upload actions without an
      explicit privacy review and user authorization: traces can contain device and
      session data.

## Testing and reliability

- [x] Add a mock-Bluetooth end-to-end test using
      `smartcube-web-bluetooth/src/test/bluetooth-mock`: connect, initial state,
      moves, facelets, gyro/regrip, custom trigger, and disconnect. A compact,
      redacted JSONL replay fixture snapshots session-only trigger semantics.
- [x] Add browser-level coverage for live-trace filtering, selection,
      JSONL export/copy, fixed detail pane, and local move replay.
- [ ] Add browser-level coverage for live-trace auto-follow.
- [x] Render the R/U/F gizmo in Chromium and verify red/white/green WebGL
      axis pixels without a platform-specific screenshot baseline.
- [ ] Revisit sparse-sample regrip detection (for example a packet that skips
      a cardinal confirmation pose) after hardware traces establish its impact.
- [x] Run and resolve the remaining dependency audit findings without
      needlessly accepting breaking upgrades. _(Current `npm audit`: clean;
      retain this as a periodic check.)_

## Developer experience and documentation

- [x] Add project-wide ReScript/Prettier formatting, a CI format gate, and
      ignore generated ReScript declarations.
- [x] Add `npm run docs:api` TypeDoc generation for the TypeScript public
      boundary; generated `docs/api/` is intentionally untracked.
- [x] Serve the generated TypeDoc site at `/docs/api/index.html` locally and
      under GitHub Pages, with a local fallback guide before docs are generated.
- [ ] Use `rescript-tools doc` JSON as input for a ReScript-native documentation
      view only if TypeDoc's TypeScript-facing API docs prove insufficient.

## Core/package boundary

- [x] Move the remaining pure facelet-grid reframing adapter from
      `session/virtualMoveFrame.ts` into `domain/VirtualCubeFrame`.
- [ ] Finish Stage 3 packaging: publishable root/core exports, peer dependency
      boundary for `smartcube-web-bluetooth`, private `examples/web` workspace,
      split TypeScript/Vitest configs, and `npm pack` smoke test.
- [x] Add a CI snapshot/check of handled smartcube event types so dependency
      upgrades expose new protocol events deliberately.
- [x] Refresh README with the four-layer architecture, profiles, virtual
      regrips, magnetic stabilization, JSONL, trace sidebar, commands, and custom triggers.

## Upstream/community

- [ ] Prepare a focused `cube-rosetta` contribution for the validated virtual
      regrip fixes: local-frame composition, notation/sensor sign handling, and
      confirmation near cardinal poses.
