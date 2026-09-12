import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../dist/.vite/manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entry = manifest['index.html'];
if (!entry?.isEntry) throw new Error('Vite manifest has no index.html entry');

const eagerKeys = new Set();
const visitEager = (key) => {
  if (eagerKeys.has(key)) return;
  eagerKeys.add(key);
  for (const dependency of manifest[key]?.imports ?? []) visitEager(dependency);
};
visitEager('index.html');

const requiredSources = [
  'src/app/replayPanel.ts',
  'packages/core/dist/session/replay/replaySession.js',
  'packages/core/dist/session/replay/jsonlMock.js',
  'packages/core/src/session/replay/fixtures/gocube-edge-ui.jsonl',
  'packages/core/src/session/replay/fixtures/gan-ui12-ui.jsonl',
];
for (const source of requiredSources) {
  const key = Object.keys(manifest).find(
    (candidate) => candidate.startsWith(source) || manifest[candidate]?.src?.startsWith(source),
  );
  if (!key) throw new Error(`Vite manifest is missing lazy replay source: ${source}`);
}

const replayKeys = Object.keys(manifest).filter((key) => {
  const { name = '', src = '' } = manifest[key] ?? {};
  return (
    name === 'replaySession' ||
    name === 'jsonlMock' ||
    key.includes('replayPanel') ||
    src.includes('replayPanel') ||
    key.includes('/session/replay/') ||
    src.includes('/session/replay/')
  );
});
const eagerReplay = replayKeys.filter((key) => eagerKeys.has(key));
if (eagerReplay.length > 0) {
  throw new Error(`Replay code entered the eager app graph: ${eagerReplay.join(', ')}`);
}

console.log(`Replay boundary verified: ${replayKeys.length} chunks remain lazy.`);
