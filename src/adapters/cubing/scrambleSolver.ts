import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';

import { faceletsToPattern, kpuzzleReady } from './utils';
import type { ScrambleSolver } from '../../integration/cubeEvents';

export const createCubingScrambleSolver = (): ScrambleSolver => async (facelets) => {
  await kpuzzleReady;
  const solution = await experimentalSolve3x3x3IgnoringCenters(faceletsToPattern(facelets));
  return solution.invert().toString();
};
