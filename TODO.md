# Remaining topics

## Validate on real cubes

- [ ] Smoke-tune GoCube and GAN profiles: `radiusDeg`, `snapDeg`,
  `hysteresisDeg`, `velocityMax`, and `driftDegPerSec`.
- [x] Validate virtual x/y/z regrips and the R/U/F gizmo against captured and
  live hardware sessions, including mixed-axis and quick reversal handling.
- [ ] Tune or make configurable the 300 ms returned-face `CUSTOM_TRIGGER`
  window after real-cube testing.

## Product/UI

- [ ] Add a visible move counter and promote the active solve timer near the
  move editor.
- [ ] Decide whether Device Info should be collapsible on compact screens.
- [ ] Consider a decoded cube-state presentation (2D net or concise summary)
  instead of raw CP/CO/EP/EO text.
- [ ] Decide whether detected moves need an optional chip/badge view in
  addition to the editable solver-friendly text field.
- [ ] Add user-facing feedback for Copy, Reset State confirmation, and custom
  move triggers.

## Testing and reliability

- [ ] Add a mock-Bluetooth end-to-end test using
  `smartcube-web-bluetooth/src/test/bluetooth-mock`: connect, initial state,
  moves, facelets, gyro/regrip, custom trigger, and disconnect.
- [ ] Add browser-level coverage for live-trace filtering/auto-follow and the
  R/U/F gizmo rendering path.
- [ ] Revisit sparse-sample regrip detection (for example a packet that skips
  a cardinal confirmation pose) after hardware traces establish its impact.
- [ ] Run and resolve the remaining dependency audit findings without
  needlessly accepting breaking upgrades.

## Core/package boundary

- [ ] Move the remaining pure facelet-grid reframing adapter from
  `session/virtualMoveFrame.ts` into `domain/VirtualCubeFrame`.
- [ ] Finish Stage 3 packaging: publishable root/core exports, peer dependency
  boundary for `smartcube-web-bluetooth`, private `examples/web` workspace,
  split TypeScript/Vitest configs, and `npm pack` smoke test.
- [ ] Add a CI snapshot/check of handled smartcube event types so dependency
  upgrades expose new protocol events deliberately.
- [ ] Refresh README with the four-layer architecture, profiles, virtual
  regrips, magnetic stabilization, JSONL, trace sidebar, and custom triggers.

## Upstream/community

- [ ] Prepare a focused `cube-rosetta` contribution for the validated virtual
  regrip fixes: local-frame composition, notation/sensor sign handling, and
  confirmation near cardinal poses.
