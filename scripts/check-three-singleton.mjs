import { readFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const installations = Object.entries(lock.packages ?? {})
  .filter(([path]) => /(^|\/)node_modules\/three$/.test(path))
  .map(([path, metadata]) => ({ path: path || '.', version: metadata.version }));

if (installations.length !== 1) {
  console.error('Expected exactly one Three.js installation in package-lock.json:');
  installations.forEach(({ path, version }) => console.error(`- ${path}: ${version}`));
  process.exitCode = 1;
} else {
  console.log(`Three.js singleton verified: ${installations[0].version}`);
}
