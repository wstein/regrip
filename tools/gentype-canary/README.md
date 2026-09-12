# genType canary

This isolated, non-workspace package tests whether the pinned ReScript and genType toolchain can produce a typed TypeScript boundary from one annotated ReScript value.

It is intentionally outside `packages/`: it is not part of the npm workspace, never enters `@wstein/regrip-core`'s packed files, and does not change production imports.

Run it independently:

```sh
npm ci --prefix tools/gentype-canary
npm run verify --prefix tools/gentype-canary
```

Success requires all three conditions:

1. ReScript writes `src/Time.res.js`.
2. genType writes `src/Time.gen.ts` with a typed `format` export.
3. TypeScript accepts a consumer of that generated export and the emitted runtime formats `61_001` as `1:01.001`.

The CI job is deliberately non-blocking while this toolchain capability is under investigation. Do not migrate core modules until the canary is green.
