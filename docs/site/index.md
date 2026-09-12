---
layout: doc
---

# Regrip Dev Console documentation

Regrip Dev Console is a browser developer console for supported smart cubes. Connect over Bluetooth,
inspect the live trace, and export the exact evidence used to update the cube view.

## Getting started

Open the [Console](https://wstein.github.io/regrip/) in a Bluetooth-capable browser, select
**Connect**, and pick a cube from the system pairing dialog. There is no account or installation
step.

## Connecting a cube

The console selects the device protocol automatically. The connection panel reports its protocol,
capabilities, firmware, battery level, and gyro support. Use **Sync state** to request the next
facelet state from the device even when it has already reported the same state.

## Events and diagnostics

Moves, facelet updates, gyro readings, and regrips are typed cube events. They update cube state and
are available for JSONL export and replay. The default-off **Diagnostic** trace filter is separate:
it records decoder evidence without entering move tracking, facelet reconciliation, triggers, or
normal JSONL replay capture.

Diagnostic packet kinds are `RAW_PACKET`, `DECODED_PACKET`, `MALFORMED_PACKET`, and
`UNKNOWN_PACKET`. A valid decoded packet still produces its normal cube event; unknown packets stay
diagnostic-only.

## Move notation

Detected moves are retained as live quarter-turn moves. Choose WCA, SiGN, or SSE notation for the
editable solver-frame algorithm, and use **Simplify** only when you explicitly want a reduced
export. **Raw QTM** is a read-only diagnostic view of the original body-frame `MOVE` packets; it is
not changed by simplifying the editable algorithm.

## API reference

The [API reference](/api/) is generated from the TypeScript boundary of
`@wstein/regrip-core` and lives inside this same documentation site.
