import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const coreRoot = dirname(dirname(fileURLToPath(import.meta.url)));
rmSync(join(coreRoot, 'dist'), { recursive: true, force: true });
