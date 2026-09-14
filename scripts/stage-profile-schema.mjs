import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve('packages/core/src/profiles/smartcube-profile.schema.json');
const target = resolve('dist/smartcube-profile.schema.json');

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
