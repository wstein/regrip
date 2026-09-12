import { format } from '@wstein/regrip-core/domain/Time';
import { step as stepTimer } from '@wstein/regrip-core/domain/Timer';
import {
  initial as initialPlayerSync,
  move as playerMove,
} from '@wstein/regrip-core/domain/PlayerSync';
import { degreesToRadians, fromEuler } from '@wstein/regrip-core/domain/Quaternion';
import { regripFromString, token } from '@wstein/regrip-core/domain/CubeNotation';
import {
  faceletsToPatternData,
  solvedFacelets,
} from '@wstein/regrip-core/domain/CubeFacelets.res.mjs';
import { initial, pushRecent, recentMoves } from '@wstein/regrip-core/domain/MoveBuffer';
import { initial as initialMoveTracker, observeMove } from '@wstein/regrip-core/domain/MoveTracker';
import {
  initial as initialSnapshotDeduper,
  observe,
} from '@wstein/regrip-core/domain/SnapshotDeduper';
import {
  defaults as moveBackDefaults,
  initial as initialMoveBackTrigger,
  step,
} from '@wstein/regrip-core/domain/MoveBackTrigger';
import { cubeTimestampCalcSkew } from '@wstein/regrip-core/bindings/Bindings_SmartCube';

const actual = format(61_001);
if (actual !== '1:01.001') {
  throw new Error(`expected formatted duration 1:01.001, received ${actual}`);
}

const pattern = faceletsToPatternData(solvedFacelets);
const patternKeys = Object.keys(pattern).sort().join(',');
if (patternKeys !== 'CENTERS,CORNERS,EDGES') {
  throw new Error(`expected cubing.js KPatternData keys, received ${patternKeys}`);
}

const [timerState, timerEffects] = stepTimer('idle', 'activate', true);
if (timerState !== 'ready' || !timerEffects.includes('showTimer')) {
  throw new Error('expected generated Timer wrapper to preserve tagged effects');
}

const [, playerEffects] = playerMove(initialPlayerSync, 'R');
if (
  playerEffects.length !== 1 ||
  playerEffects[0]?.kind !== 'addMove' ||
  playerEffects[0].move !== 'R'
) {
  throw new Error('expected generated PlayerSync wrapper to preserve tagged effects');
}

const quarterTurn = fromEuler({ x: degreesToRadians(90), y: 0, z: 0 });
if (
  Math.abs(quarterTurn.x - Math.SQRT1_2) > 1e-12 ||
  Math.abs(quarterTurn.w - Math.SQRT1_2) > 1e-12
) {
  throw new Error('expected generated Quaternion wrapper to preserve structural records');
}

if (token('y', '2') !== 'y2' || regripFromString("x'") !== "x'") {
  throw new Error('expected generated CubeNotation wrapper to preserve literal tokens');
}

const moves = recentMoves(pushRecent(initial(), 'R'));
if (moves.length !== 1 || moves[0] !== 'R') {
  throw new Error('expected generated MoveBuffer wrapper to preserve a recent move');
}

const [afterFirst] = observeMove(initialMoveTracker, 1);
const [, gap] = observeMove(afterFirst, 5);
if (!gap || gap.previousSerial !== 1 || gap.serial !== 5 || gap.missing !== 3) {
  throw new Error('expected generated MoveTracker wrapper to detect a serial gap');
}

const [, isNew] = observe(initialSnapshotDeduper, { serial: 1, facelets: 'x' });
if (!isNew) {
  throw new Error('expected generated SnapshotDeduper wrapper to treat the first snapshot as new');
}

const [, triggered] = step(initialMoveBackTrigger, 'R', 0, moveBackDefaults);
if (triggered !== undefined) {
  throw new Error('expected generated MoveBackTrigger wrapper to require a returning move first');
}

const skew = cubeTimestampCalcSkew([]);
if (skew !== 0) {
  throw new Error('expected generated Bindings_SmartCube wrapper to call the transport stub');
}
