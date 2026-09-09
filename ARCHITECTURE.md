# Regrip — Architecture Guide

This document explains **why** the codebase is structured the way it is.
Reading it once will save you hours of confusion when you first encounter the layer boundaries.

---

## The core problem: hardware is chaos, math is not

A smart cube session emits a continuous stream of raw BLE events — quaternion samples, face moves,
facelets snapshots — from devices that drop packets, stutter clocks, and jitter sensors. The obvious
implementation entangles UI updates directly with move-detection logic, making both untestable and
unreproducible when something goes wrong.

Regrip solves this by separating concerns into **four strict layers**:

```
src/app/        presentation only — DOM, styles, composition root
src/adapters/   third-party renderers (Three.js, cubing.js)
src/session/    BLE lifecycle, event routing, effects
src/domain/     pure ReScript functions — no side effects, ever
src/bindings/   typed boundary to the BLE library
```

Imports flow **downward only**. ESLint's `no-restricted-paths` rules in `eslint.config.js` enforce
this mechanically — a domain file importing from `app/` is a build error, not a code-review note.

---

## Why pure functions in `src/domain/`?

### The old way (imperative)

```ts
// ❌ Before: state is entangled with effects
class CubeController {
  private faces: string[] = ['U','U',...];

  onBleMoveEvent(face: string, dir: number) {
    this.faces = applyMove(this.faces, face, dir); // mutates in place
    document.getElementById('cube-state')!.textContent = this.faces.join(''); // side effect
    this.renderThreeJS(); // another side effect
  }
}
```

Testing `onBleMoveEvent` requires a DOM, a Three.js context, and a live BLE device.
A dropped packet leaves `this.faces` in an unknown state with no reproducible way to debug it.

### The new way (pure reducer)

```ts
// ✅ Now: (state, action) → state, zero side effects
// src/domain/MoveBuffer.res — compiled from ReScript
let processMove = (state: MoveBuffer.State, move: SmartCubeMoveEvent): MoveBuffer.State => ...
```

The same input always produces the same output. The domain never touches the DOM, the renderer,
or the Bluetooth socket. Testing is trivial:

```ts
it('buffers two quick moves', () => {
  const s0 = MoveBuffer.initial();
  const s1 = MoveBuffer.processMove(s0, fakeMove('R', t0));
  const s2 = MoveBuffer.processMove(s1, fakeMove('U', t0 + 50));
  expect(s2.pending).toHaveLength(2);
});
```

---

## Time as an explicit argument — the JSONL superpower

The most important architectural decision is that **timestamps are passed in, never read from
`Date.now()`** inside domain functions:

```ts
// src/domain/Time.res
let format: (milliseconds: float) => string
// src/domain/Timer.res
let transition: (state: State, action: Action, ~now: float) => (State, Effect)
//                                                    ^^^^^ explicit
```

This is not pedantry. It is what makes **JSONL session replay** work:

1. A user reports a crash sequence. Their `session.jsonl` is a text file where every line is the
   raw event exactly as it arrived from the BLE device, including its original timestamp.
2. You feed that file into `jsonlMock.e2e.test.ts`, which injects each event with its **recorded**
   timestamp into `smartCubeSession.ts`.
3. The pure domain functions receive those historical timestamps and produce byte-identical output
   to the original live session — down to the millisecond.

If `now()` were called inside the domain, replay would produce different results every run.
The architecture treats time as controlled test data, not ambient system state.

---

## The adapter layer: "intelligent dam, not pass-through"

`src/session/` is intentionally complex. Its job is to:

1. **Buffer** high-frequency BLE events (gyro can arrive at 50+ Hz)
2. **Batch and flush** contiguous BLE gyro packets at the render rate (≈60 Hz via `requestAnimationFrame`)
3. **Filter** sub-threshold microjitter from the emitted display stream (default: 0.5°)
4. **Format** raw wire data into typed actions the domain understands
5. **Apply effects** returned by pure reducers (start timer, play sound, update DOM)

The session is the only layer allowed to touch `Date.now()`, `requestAnimationFrame`, or the
Bluetooth socket. This concentration of impurity is intentional — it makes the domain a clean room
and makes the adapter a single, well-defined debugging target.

> If the 3D cube renders incorrectly, the bug is either in the Three.js adapter (wrong draw call)
> or in the domain math (wrong quaternion). They cannot infect each other.

---

## Layer boundary rules

| From ↓ / To → | `app` | `adapters` | `session` | `domain` | `bindings` |
| ------------- | ----- | ---------- | --------- | -------- | ---------- |
| `app`         | ✅    | ✅         | ✅        | ❌       | ❌         |
| `adapters`    | ❌    | ✅         | ✅        | ✅       | ❌         |
| `session`     | ❌    | ❌         | ✅        | ✅       | ✅         |
| `domain`      | ❌    | ❌         | ❌        | ✅       | ❌         |
| `bindings`    | ❌    | ❌         | ❌        | ❌       | ✅         |

`domain` imports nothing outside itself. Any violation is a **lint error in CI**.

---

## `Timer.res` is the canonical domain pattern

When in doubt, follow `src/domain/Timer.res`. It is a state machine with:

- An opaque `State` type
- An `initial` value
- A `transition(state, action, ~now)` function returning `(State, Effect)`
- A `Effect` variant describing what the session layer should do next

Effects are **data**, not imperative calls. The session layer pattern-matches on them and executes
the side effects. This keeps the domain pure and makes every state transition testable with a
one-liner.

---

## Common mistakes to avoid

**❌ Importing a UI framework into `src/session/`**
Signals, React hooks, or DOM APIs have no place in the session. The session emits events; `src/app/`
translates them into reactive UI primitives.

**❌ Calling `Date.now()` in `src/domain/`**
Timestamps must be injected from the session layer so JSONL replay works.

**❌ Adding side effects to domain reducers**
`console.log`, DOM manipulation, and network calls inside a `.res` file will break determinism and
replay. Put effects in the `Effect` return value and execute them in the session.

**❌ Bypassing the adapter to call domain functions directly from `src/app/`**
The ESLint rules block this, but the reason matters: the adapter batches, filters, and formats
raw events into the exact shape the domain expects. Skipping it produces garbage input.

---

## Further reading

- [README.md](README.md) — event pipeline diagram and project overview
- `src/domain/Timer.res` — canonical pure reducer pattern
- `src/session/jsonlMock.e2e.test.ts` — JSONL replay in action
- `eslint.config.js` — `no-restricted-paths` rules that enforce the boundaries
