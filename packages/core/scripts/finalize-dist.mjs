import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const coreRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundledPath = join(coreRoot, 'dist/session/profile/bundled.js');
const profilesDirectory = join(coreRoot, 'dist/profiles/profiles');
const profiles = [
  ['base', 'base.json'],
  ['ganGen2', 'gan-gen2.json'],
  ['ganI4', 'gan-i4.json'],
  ['ganGen4', 'gan-gen4.json'],
  ['gocube', 'gocube.json'],
  ['moyu', 'moyu-ai.json'],
  ['qiyi', 'qiyi.json'],
  ['giiker', 'giiker.json'],
  ['unknown', 'unknown.json'],
];

let bundled = readFileSync(bundledPath, 'utf8');
for (const [binding, filename] of profiles) {
  const importLine = `import ${binding} from '../../profiles/profiles/${filename}';`;
  if (!bundled.includes(importLine)) {
    throw new Error(`Expected profile import was not emitted: ${importLine}`);
  }
  const value = JSON.parse(readFileSync(join(profilesDirectory, filename), 'utf8'));
  bundled = bundled.replace(importLine, `const ${binding} = ${JSON.stringify(value)};`);
}
writeFileSync(bundledPath, bundled);
