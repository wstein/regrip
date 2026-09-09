# Regrip core

Private MIT ReScript source package shared by the Regrip lab and CubeLab.

It owns the smart-cube transport contract, session lifecycle, calibrated
gyro/regrip reducers, profiles, commands, and deterministic JSONL replay. It
deliberately excludes browser chooser UI, the Three adapter, trace UI, and
cube-state presentation.

The package is intentionally unpublished while the CubeLab GAN and GoCube
migrations establish its API. Consumers compile its ReScript sources through
the normal `rescript.json` dependency mechanism and can use its generated
JavaScript surface from TypeScript adapters.
