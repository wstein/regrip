import base from '../../profiles/profiles/base.json';
import ganGen2 from '../../profiles/profiles/gan-gen2.json';
import ganI4 from '../../profiles/profiles/gan-i4.json';
import ganGen4 from '../../profiles/profiles/gan-gen4.json';
import gocube from '../../profiles/profiles/gocube.json';
import moyu from '../../profiles/profiles/moyu-ai.json';
import qiyi from '../../profiles/profiles/qiyi.json';
import giiker from '../../profiles/profiles/giiker.json';
import unknown from '../../profiles/profiles/unknown.json';
import type { SmartCubeProfile } from './types';

/** Built-in cube profiles selected from the connected device identity. */
export const bundledProfiles: SmartCubeProfile[] = [
  // JSON imports widen discriminant literals to `string`; schema.test.ts
  // validates this bundled data before it reaches the typed session boundary.
  base as SmartCubeProfile,
  ganGen2,
  ganI4,
  ganGen4,
  gocube,
  moyu,
  qiyi,
  giiker,
  unknown,
];
