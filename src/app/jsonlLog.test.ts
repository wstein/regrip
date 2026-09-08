import { describe, expect, it } from 'vitest';

import { createJsonlLog } from './jsonlLog';

describe('JSONL log', () => {
  it('records only between start and stop as newline-delimited JSON', () => {
    const log = createJsonlLog(() => '2026-09-08T12:00:00.000Z');
    log.record('ignored', {});
    log.start({ profile: 'gocube' });
    log.record('cube_event', { type: 'BATTERY', batteryLevel: 98 });
    const lines = log.stop().trim().split('\n').map(line => JSON.parse(line));

    expect(lines).toEqual([
      { recordedAt: '2026-09-08T12:00:00.000Z', type: 'log_started', data: { profile: 'gocube' } },
      { recordedAt: '2026-09-08T12:00:00.000Z', type: 'cube_event', data: { type: 'BATTERY', batteryLevel: 98 } },
      { recordedAt: '2026-09-08T12:00:00.000Z', type: 'log_stopped', data: { entries: 2 } },
    ]);
  });
});
