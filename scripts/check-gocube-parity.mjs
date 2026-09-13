import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import * as GyroOrientation from '../packages/core/dist/domain/GyroOrientation.gen.js';
import * as RegripDetector from '../packages/core/dist/domain/RegripDetector.gen.js';
import * as SensorToBody from '../packages/core/dist/domain/SensorToBody.gen.js';

const fixturePath = process.argv[2];
if (!fixturePath) {
  console.error('Usage: npm run parity:gocube -- /path/to/gocube-yxz.json');
  process.exitCode = 2;
} else {
  const oracle = JSON.parse(
    await readFile(new URL('../test/fixtures/gocube-yxz.oracle.json', import.meta.url), 'utf8'),
  );
  const bytes = await readFile(resolve(fixturePath));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const events = JSON.parse(bytes.toString('utf8'));
  const gyroEvents = events.filter((event) => event.type === 'GYRO');
  const moveEvents = events.filter((event) => event.type === 'MOVE');
  const metadata = {
    sha256,
    events: events.length,
    gyroEvents: gyroEvents.length,
    moveEvents: moveEvents.length,
    durationMs: events.at(-1)?.t,
  };
  const expectedMetadata = {
    sha256: oracle.sha256,
    events: oracle.events,
    gyroEvents: oracle.gyroEvents,
    moveEvents: oracle.moveEvents,
    durationMs: oracle.durationMs,
  };
  if (JSON.stringify(metadata) !== JSON.stringify(expectedMetadata)) {
    throw new Error(
      `Fixture identity mismatch\nexpected ${JSON.stringify(expectedMetadata)}\nreceived ${JSON.stringify(metadata)}`,
    );
  }

  let gyroState = GyroOrientation.initial;
  let regripState = RegripDetector.initial;
  const tokens = [];
  const observations = [];
  for (const event of gyroEvents) {
    // The historical fixture stores GoCube wire coordinates. Mirror the
    // transport decoder before handing each sample to the core profile map.
    const { x, y, z, w } = event.quaternion;
    const transportQuaternion = { x, y: -z, z: -y, w };
    const [nextGyroState, relative] = GyroOrientation.relative(
      gyroState,
      transportQuaternion,
      SensorToBody.default,
    );
    gyroState = nextGyroState;
    const [nextRegripState, observation] = RegripDetector.step(regripState, relative, {
      thresholdDeg: oracle.thresholdDeg,
    });
    regripState = nextRegripState;
    if (observation) {
      tokens.push(observation.notationToken);
      observations.push({ t: event.t, relative, token: observation.notationToken });
    }
  }

  if (JSON.stringify(tokens) !== JSON.stringify(oracle.tokens)) {
    throw new Error(
      `GoCube parity mismatch\nexpected ${oracle.tokens.join(' ')}\nreceived ${tokens.join(' ')}\nobserved ${JSON.stringify(observations)}`,
    );
  }
  console.log(`GoCube parity OK: ${tokens.length} tokens (${tokens.join(' ')})`);
}
