import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

const writeTransportPeerStub = (directory) => {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'package.json'),
    `${JSON.stringify(
      {
        name: 'smartcube-web-bluetooth',
        version: '4.0.0',
        type: 'module',
        exports: { types: './index.d.ts', default: './index.js' },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(directory, 'index.js'),
    // Minimal runtime bodies so the generated Bindings_SmartCube wrapper has
    // something real to call through to, proving the FFI boundary resolves
    // and executes rather than only type-checking.
    `export const cubeTimestampCalcSkew = () => 0;
export const cubeTimestampLinearFit = (moves) => moves;
`,
  );
  writeFileSync(
    join(directory, 'index.d.ts'),
    `export type SmartCubeCapabilities = unknown;
export type SmartCubeCommand = unknown;
export type SmartCubeDiagnosticEvent = unknown;
export type SmartCubeEvent = unknown;
export type SmartCubeProtocolInfo = unknown;
export type SmartCubeVendorCommand = unknown;
`,
  );
};

const run = (args, cwd = root) =>
  execFileSync(npm, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, npm_config_cache: npmCache, NPM_CONFIG_CACHE: npmCache },
  });

try {
  run(['pack', '--silent', '--workspace', '@wstein/regrip-core', '--pack-destination', temp]);

  const tarball = join(
    temp,
    readdirSync(temp).find(
      (name) => name.startsWith('wstein-regrip-core-') && name.endsWith('.tgz'),
    ) ?? '',
  );
  if (!tarball.endsWith('.tgz')) {
    throw new Error('npm pack did not produce a core tarball.');
  }
  const transportPeerStub = join(temp, 'smartcube-web-bluetooth');
  writeTransportPeerStub(transportPeerStub);

  const packedFiles = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split('\n');
  const required = [
    'package/dist/index.js',
    'package/dist/index.d.ts',
    'package/dist/domain/Time.gen.js',
    'package/dist/domain/Time.res.mjs',
    'package/dist/domain/MoveBuffer.gen.js',
    'package/dist/domain/MoveBuffer.res.mjs',
    'package/dist/domain/Timer.gen.js',
    'package/dist/domain/Timer.res.mjs',
    'package/dist/domain/PlayerSync.gen.js',
    'package/dist/domain/PlayerSync.res.mjs',
    'package/dist/domain/Quaternion.gen.js',
    'package/dist/domain/Quaternion.res.mjs',
    'package/dist/domain/CubeNotation.gen.js',
    'package/dist/domain/CubeNotation.res.mjs',
    'package/dist/domain/SensorToBody.gen.js',
    'package/dist/domain/SensorToBody.res.mjs',
    'package/dist/domain/GyroOrientation.gen.js',
    'package/dist/domain/GyroOrientation.res.mjs',
    'package/dist/domain/CubeSymmetry.gen.js',
    'package/dist/domain/CubeSymmetry.res.mjs',
    'package/dist/domain/MagneticDetent.gen.js',
    'package/dist/domain/MagneticDetent.res.mjs',
    'package/dist/domain/OrientationStabilizer.gen.js',
    'package/dist/domain/OrientationStabilizer.res.mjs',
    'package/dist/domain/GyroPipeline.gen.js',
    'package/dist/domain/GyroPipeline.res.mjs',
    'package/dist/domain/MoveTracker.gen.js',
    'package/dist/domain/MoveTracker.res.mjs',
    'package/dist/domain/SnapshotDeduper.gen.js',
    'package/dist/domain/SnapshotDeduper.res.mjs',
    'package/dist/domain/MoveBackTrigger.gen.js',
    'package/dist/domain/MoveBackTrigger.res.mjs',
    'package/dist/bindings/Bindings_SmartCube.gen.js',
    'package/dist/bindings/Bindings_SmartCube.res.mjs',
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
    'smartcube-web-bluetooth': `file:${transportPeerStub}`,
  };
  consumerPackage.devDependencies = {
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
  execFileSync(process.execPath, ['time-runtime.mjs'], { cwd: consumer, stdio: 'inherit' });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
