import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Step 1: genType must actually have run.
const generated = resolve('src/Time.gen.ts');
if (!existsSync(generated)) {
  throw new Error(
    'genType did not generate src/Time.gen.ts. The core migration remains blocked until this canary passes.',
  );
}

// Step 2: real compilation, not --noEmit. This is the part a type-check-only
// canary skips: it proves the generated wrapper is valid emittable TypeScript,
// not just valid enough for the checker to accept it in isolation.
execFileSync('npx', ['tsc', '--project', 'tsconfig.json'], { stdio: 'inherit' });

// Step 3: the compiled wrapper's own relative import (./Time.res.js) only
// resolves at runtime if the raw ReScript runtime output ships beside it —
// exactly the packaging shape @wstein/regrip-core would need after `npm
// pack`. tsc does not copy non-TS files into outDir; do it explicitly here.
copyFileSync(resolve('src/Time.res.js'), resolve('dist/src/Time.res.js'));

// Step 4: execute the compiled dist output — the actual publishable
// chain (Time.res -> Time.res.js -> Time.gen.ts -> dist/Time.gen.js) — in a
// fresh Node process, not by importing the pre-compiled source directly.
execFileSync('node', ['dist/consumer.js'], { stdio: 'inherit' });
