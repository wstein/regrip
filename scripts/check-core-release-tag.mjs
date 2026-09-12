import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(root, 'packages/core/package.json'), 'utf8'));
const expectedTag = `core-v${packageJson.version}`;
const actualTag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (!actualTag) {
  throw new Error(`Core release tag is required; expected ${expectedTag}.`);
}

if (actualTag !== expectedTag) {
  throw new Error(
    `Core release tag ${actualTag} does not match packages/core/package.json (${expectedTag}).`,
  );
}

console.log(`Core release tag matches package version: ${actualTag}`);
