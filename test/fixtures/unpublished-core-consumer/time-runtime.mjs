import { format } from '@wstein/regrip-core/domain/Time';
import { initial, pushRecent, recentMoves } from '@wstein/regrip-core/domain/MoveBuffer';

const actual = format(61_001);
if (actual !== '1:01.001') {
  throw new Error(`expected formatted duration 1:01.001, received ${actual}`);
}

const moves = recentMoves(pushRecent(initial(), 'R'));
if (moves.length !== 1 || moves[0] !== 'R') {
  throw new Error('expected generated MoveBuffer wrapper to preserve a recent move');
}
