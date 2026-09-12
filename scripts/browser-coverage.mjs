import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryDirectory = join(root, '.nyc_output');
const command = process.argv[2];

if (command === 'prepare') {
  rmSync(temporaryDirectory, { recursive: true, force: true });
  mkdirSync(temporaryDirectory, { recursive: true });
} else {
  throw new Error(`Expected "prepare", received ${JSON.stringify(command)}`);
}
