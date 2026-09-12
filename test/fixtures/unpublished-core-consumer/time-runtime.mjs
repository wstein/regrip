import { format } from '@wstein/regrip-core/domain/Time';

const actual = format(61_001);
if (actual !== '1:01.001') {
  throw new Error(`expected formatted duration 1:01.001, received ${actual}`);
}
