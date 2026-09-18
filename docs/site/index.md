---
layout: doc
---

# Regrip Dev Console documentation

Regrip Dev Console is a browser developer console for supported smart cubes. Connect over Bluetooth,
inspect the live trace, and export the exact evidence used to update the cube view.

## Getting started

Open the [Console](https://wstein.github.io/regrip/console/) in a Bluetooth-capable browser, select
**Connect**, and pick a cube from the system pairing dialog. There is no account or installation
step.

No cube handy? Open the **Connect** menu and choose a bundled fixture (GoCube Edge, GAN UI12) or
**Load JSONL capture…** to load a local recording — either exercises the full console in replay
mode, with play/step/scrub controls and adjustable speed, without any hardware.

## Connecting a cube

The console selects the device protocol automatically. The connection panel reports its protocol,
capabilities, hardware and software versions, battery level, and gyro support. Use **Sync state**
to request the next facelet state from the device even when it has already reported the same
state.

## Events and diagnostics

Moves, facelet updates, gyro readings, and regrips are typed cube events. They update cube state and
are available for JSONL export and replay. The default-off **Diagnostic** trace filter is separate:
it records decoder evidence without entering move tracking, facelet reconciliation, triggers, or
normal JSONL replay capture.

Diagnostic packet kinds are `RAW_PACKET`, `DECODED_PACKET`, `MALFORMED_PACKET`, and
`UNKNOWN_PACKET`. A valid decoded packet still produces its normal cube event; unknown packets stay
diagnostic-only.

The **Live trace** sidebar lists every event as it arrives. Filter by category (Move, Event, State,
Command, Unknown, Diagnostic, Gyro, Regrip, Trigger, Shake), select individual entries to
**Reproduce moves** from them, and scope **Download**/**Copy** to Filtered, All, or Selected events.

## Move notation

Detected moves are retained as live quarter-turn moves. Choose WCA, SiGN, SSE, or Jaap notation for
the editable solver-frame algorithm, and use **Simplify** only when you explicitly want a reduced
export. **Raw QTM** is a read-only diagnostic view of the original body-frame `MOVE` packets; it is
not changed by simplifying the editable algorithm.

### Jaap notation

The Jaap editor accepts standard face turns plus these aliases for every face:

| Alias | Meaning                    |
| ----- | -------------------------- |
| `Rs`  | `R L'` (slice pair)        |
| `Ra`  | `R L` (anti-slice pair)    |
| `Rm`  | R-relative middle slice    |
| `Rc`  | whole-cube R-axis rotation |

It also accepts nested positive repeat groups such as `(R U R' U')6`. The same parser accepts the
canonical `M`/`E`/`S`, `x`/`y`/`z`, and wide-move spellings that may already be in a detected stream.
Malformed Jaap groups and aliases are marked inline and **Simplify** stays disabled until they are
corrected.

Simplify works on canonical move meaning, then renders the result in the notation you selected. It
therefore keeps **Jaap** selected, but does not recreate cosmetic `Rs`/`Ra` aliases or repeat groups.
It emits ordinary face turns and safe `m`/`c` aliases; a canonical wide move is expanded into its Jaap
face turn plus regrip (for example `Rw` becomes `L Rc`).

## Cube-state exports

Every format under **Copy state** describes the physical cube in the canonical `URFDLB` body frame.
The values do not rotate when the virtual grip changes: regrips affect the user-facing move
notation and grip indicator, but not compact, spaced, or color facelets, permutation cycles
(Singmaster or SSE), cubie coordinates, KPattern JSON, Regrip state JSON, or Orbit64. This keeps
exports stable and directly comparable with protocol snapshots, solvers, and external tools.

The **Colors** toggle above the cube view switches between Western, Japanese, and Custom color
schemes. Japanese uses the standard arrangement where blue and yellow swap places (white opposite
blue, green opposite yellow). Custom lets you configure individual face colors via the settings gear.
The selected color scheme is dynamically applied across the live 3D cube view, the orientation gizmo,
and the **Color facelets (WRGYOB)** export.

## API reference

The [API reference](/api/) is generated from the TypeScript boundary of
`@wstein/regrip-core` and lives inside this same documentation site.

## Smart-cube profiles

Bundled device profiles use the published
[Smart-cube profile JSON Schema](https://wstein.github.io/regrip/smartcube-profile.v1.schema.json) for editor validation and
autocomplete. The schema is copied directly from the core package during the Pages build. Its v1 URL
is a public compatibility contract: compatible additions stay on v1, while incompatible profile
format changes require a new URL and must retain the old schema for existing profiles.
