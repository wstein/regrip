import {
  createSmartCubeSession,
  defaultSessionFeatures,
  type SmartCubeSession,
  type SmartCubeTransportConnection,
} from '@wstein/regrip-core';
import { format } from '@wstein/regrip-core/domain/Time';
import {
  initial as initialMoveBuffer,
  pushRecent,
  recentMoves,
} from '@wstein/regrip-core/domain/MoveBuffer';

declare const connect: () => Promise<SmartCubeTransportConnection>;

const session: SmartCubeSession = createSmartCubeSession({
  connect,
  features: defaultSessionFeatures,
});

void session;
const formatted: string = format(61_001);
void formatted;
const moves: number[] = recentMoves(pushRecent(initialMoveBuffer<number>(), 1));
void moves;
