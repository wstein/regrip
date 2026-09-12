import { format } from './src/Time.gen.js';

const formatted: string = format(61_001);

if (formatted !== '1:01.001') throw new Error(`Unexpected generated-wrapper result: ${formatted}`);
console.log('gentype-canary: compiled wrapper executed, format(61_001) =', formatted);
