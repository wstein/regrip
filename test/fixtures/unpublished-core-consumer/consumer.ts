import {
  createSmartCubeSession,
  defaultSessionFeatures,
  type SmartCubeSession,
  type SmartCubeTransportConnection,
} from '@wstein/regrip-core';
import { format } from '@wstein/regrip-core/domain/Time';
import { step as stepTimer, type effect as TimerEffect } from '@wstein/regrip-core/domain/Timer';
import {
  initial as initialPlayerSync,
  move as playerMove,
  type effect as PlayerSyncEffect,
} from '@wstein/regrip-core/domain/PlayerSync';
import { identity, type t as Quaternion } from '@wstein/regrip-core/domain/Quaternion';
import {
  initial as initialMoveBuffer,
  pushRecent,
  recentMoves,
} from '@wstein/regrip-core/domain/MoveBuffer';
import { initial as initialMoveTracker, observeMove } from '@wstein/regrip-core/domain/MoveTracker';
import {
  initial as initialSnapshotDeduper,
  observe as observeSnapshot,
} from '@wstein/regrip-core/domain/SnapshotDeduper';
import {
  defaults as moveBackDefaults,
  initial as initialMoveBackTrigger,
  step as stepMoveBack,
} from '@wstein/regrip-core/domain/MoveBackTrigger';
import { cubeTimestampCalcSkew } from '@wstein/regrip-core/bindings/Bindings_SmartCube';

declare const connect: () => Promise<SmartCubeTransportConnection>;

const session: SmartCubeSession = createSmartCubeSession({
  connect,
  features: defaultSessionFeatures,
});

void session;
const formatted: string = format(61_001);
void formatted;
const [, timerEffects]: ['idle' | 'ready' | 'running' | 'stopped', TimerEffect[]] = stepTimer(
  'idle',
  'activate',
  true,
);
void timerEffects;
const [, playerEffects]: [unknown, PlayerSyncEffect[]] = playerMove(initialPlayerSync, 'R');
void playerEffects;
const quaternion: Quaternion = identity;
void quaternion;
// genType currently lowers an optional labeled argument to a required nullable
// parameter. Supplying undefined is the supported generated-boundary spelling.
void stepMoveBack(initialMoveBackTrigger, 'R', 1_000, undefined);
// @ts-expect-error genType does not currently preserve omitted labeled arguments.
void stepMoveBack(initialMoveBackTrigger, 'R', 1_000);
const moves: number[] = recentMoves(pushRecent(initialMoveBuffer<number>(), 1));
void moves;
const [, gap] = observeMove(initialMoveTracker, 1);
void gap;
const [, isNew] = observeSnapshot(initialSnapshotDeduper, { serial: 1, facelets: 'x' });
void isNew;
const [, triggered] = stepMoveBack(initialMoveBackTrigger, 'R', 0, moveBackDefaults);
void triggered;
const skew: number = cubeTimestampCalcSkew<number>([]);
void skew;
