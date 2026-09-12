import { format } from './src/Time.gen.ts';

const formatted: string = format(61_001);

if (formatted !== '1:01.001') throw new Error(`Unexpected generated-wrapper result: ${formatted}`);
