import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = join(root, 'test/fixtures/unpublished-core-consumer');
const temp = mkdtempSync(join(tmpdir(), 'regrip-core-pack-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
// `npm run` injects its own npm_config_cache, which can point at a stale global
// cache. Keep this ephemeral pack check isolated unless a caller opts in.
const npmCache = process.env.REGRIP_NPM_CACHE ?? join(tmpdir(), 'regrip-npm-cache');

const run = (args, cwd = root) =>
  execFileSync(npm, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, npm_config_cache: npmCache, NPM_CONFIG_CACHE: npmCache },
  });

try {
  run(['pack', '--silent', '--workspace', '@wstein/regrip-core', '--pack-destination', temp]);

  // A directory-based peer dependency is treated as a source install by npm,
  // which can run its `prepare` script even with `--ignore-scripts`. Pack it
  // first so the fixture consumes the same immutable artifact a real consumer
  // would, without attempting to build the peer from its published contents.
  run([
    'pack',
    '--silent',
    '--ignore-scripts',
    '--pack-destination',
    temp,
    join(root, 'node_modules/smartcube-web-bluetooth'),
  ]);

  const tarball = join(
    temp,
    readdirSync(temp).find(
      (name) => name.startsWith('wstein-regrip-core-') && name.endsWith('.tgz'),
    ) ?? '',
  );
  if (!tarball.endsWith('.tgz')) {
    throw new Error('npm pack did not produce a core tarball.');
  }
  const transportTarball = join(
    temp,
    readdirSync(temp).find(
      (name) => name.startsWith('smartcube-web-bluetooth-') && name.endsWith('.tgz'),
    ) ?? '',
  );
  if (!transportTarball.endsWith('.tgz')) {
    throw new Error('npm pack did not produce a smartcube transport tarball.');
  }

  const packedFiles = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split('\n');
  const required = [
    'package/dist/index.js',
    'package/dist/index.d.ts',
    'package/src/domain/CubeFacelets.res.mjs',
  ];
  for (const path of required) {
    if (!packedFiles.includes(path)) {
      throw new Error(`npm pack omitted required file: ${path}`);
    }
  }
  if (packedFiles.some((path) => path.includes('_test.'))) {
    throw new Error('npm pack must not include test modules.');
  }

  const consumer = join(temp, 'consumer');
  cpSync(fixture, consumer, { recursive: true });
  const packageJsonPath = join(consumer, 'package.json');
  const consumerPackage = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  consumerPackage.dependencies = {
    '@wstein/regrip-core': `file:${tarball}`,
    '@rescript/runtime': `file:${join(root, 'node_modules/@rescript/runtime')}`,
    rxjs: `file:${join(root, 'node_modules/rxjs')}`,
    'smartcube-web-bluetooth': `file:${transportTarball}`,
  };
  consumerPackage.devDependencies = {
    '@types/aes-js': `file:${join(root, 'node_modules/@types/aes-js')}`,
    '@types/node': `file:${join(root, 'node_modules/@types/node')}`,
    '@types/web-bluetooth': `file:${join(root, 'node_modules/@types/web-bluetooth')}`,
    rescript: `file:${join(root, 'node_modules/rescript')}`,
    typescript: `file:${join(root, 'node_modules/typescript')}`,
  };
  writeFileSync(packageJsonPath, `${JSON.stringify(consumerPackage, null, 2)}\n`);

  run(['install', '--ignore-scripts', '--no-package-lock'], consumer);
  run(['exec', '--', 'tsc', '--project', 'tsconfig.json'], consumer);
  run(['exec', '--', 'rescript', 'build'], consumer);
  execFileSync(process.execPath, ['src/Consumer.res.mjs'], { cwd: consumer, stdio: 'inherit' });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
