# GoCube parity oracle

The `gocube-yxz` capture is an external hardware artifact and is intentionally not
committed to this repository. Validate a local copy with:

```sh
npm run parity:gocube -- /path/to/gocube-yxz.json
```

The command checks the capture's SHA-256 hash and event metadata before replaying it.
Its expected output is stored in
[`test/fixtures/gocube-yxz.oracle.json`](../test/fixtures/gocube-yxz.oracle.json).

The oracle was audited against CubeLab immediately before its legacy orientation
pipeline was removed (`cube-rosetta` commit `9f0bb42`). Running that implementation's
own `gocube-replay.test.ts` against the committed capture yields 23 grouped tokens:
seven `y`, eight `z`, and eight `x'`. The test's prose and former expectation of
9 + 10 + 10 tokens were stale and fail against the same revision and fixture, so 29
is not the migration gate.

The capture contains three long single-axis rotations separated by face turns. The
parity contract is therefore the exact grouped sequence, not merely the token count.
The checker reproduces the GoCube transport's wire-coordinate conversion before the
core profile is applied.
