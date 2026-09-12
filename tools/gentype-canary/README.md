# genType canary

This isolated, non-workspace package tests whether the pinned ReScript and genType toolchain can produce a typed TypeScript boundary from one annotated ReScript value — and that the result survives real compilation and execution, not just type-checking.

Its custom `RegripCore` namespace and `.resi` public interface deliberately
mirror `packages/core`, so this canary can isolate compiler-layout assumptions
before they reach the published package.

It is intentionally outside `packages/`: it is not part of the npm workspace, never enters `@wstein/regrip-core`'s packed files, and does not change production imports.

Run it independently:

```sh
npm ci --prefix tools/gentype-canary
npm run verify --prefix tools/gentype-canary
```

`verify.mjs` proves the full publishable chain, not just generation and typing:

```text
Time.res
  → Time.res.js          ReScript runtime (rescript build)
  → Time.gen.ts           genType typed wrapper
  → dist/Time.gen.js      tsc emits this (real compilation, not --noEmit)
  → node dist/consumer.js  imports the compiled wrapper and runs format(61_001)
```

Success requires all of:

1. ReScript writes `src/Time.res.js`.
2. genType writes `src/Time.gen.ts` with a typed `format` export.
3. `tsc` (real emit, `outDir: dist`) compiles `consumer.ts` and the generated wrapper without error.
4. The raw ReScript runtime (`Time.res.js`) is copied beside the compiled wrapper in `dist/src/` — tsc does not do this for non-TS files, and the compiled wrapper's own relative import needs it there to resolve.
5. `node dist/consumer.js` — a fresh process, importing only the _compiled_ `dist/src/Time.gen.js` (never the pre-compiled `.ts` source) — runs and prints `format(61_001) === '1:01.001'`.

Step 5 is the part a type-check-only canary would skip: `tsc --noEmit` can accept code that fails to actually run once emitted and imported the way a real consumer (or a `npm pack`'d `@wstein/regrip-core`) would.

The CI job is deliberately non-blocking while this toolchain capability is under investigation. Do not migrate core modules until the canary is green **and** the reason `packages/core`'s own earlier genType attempt failed while this isolated one succeeds is understood — see the migration plan for that open question.
