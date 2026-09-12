import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const generated = resolve('src/Time.gen.ts');
if (!existsSync(generated)) {
  throw new Error(
    'genType did not generate src/Time.gen.ts. The core migration remains blocked until this canary passes.',
  );
}

const runtime = await import(pathToFileURL(resolve('src/Time.res.js')).href);
if (runtime.format(61_001) !== '1:01.001') {
  throw new Error('The generated ReScript runtime did not preserve Time.format.');
}

execFileSync('npx', ['tsc', '--noEmit', '--project', 'tsconfig.json'], { stdio: 'inherit' });
