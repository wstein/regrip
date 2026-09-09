import { afterEach, describe, expect, it, vi } from 'vitest';

import { createJsonlLog, downloadJsonl } from './jsonlLog';

afterEach(() => vi.unstubAllGlobals());

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

  it('attaches the download link and releases its blob URL after the click task', () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const remove = vi.fn();
    const append = vi.fn();
    const anchor = { href: '', download: '', click, remove };
    const createObjectURL = vi.fn(() => 'blob:log');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { append },
    });

    downloadJsonl('{"event":true}\n', 'cube.jsonl');

    expect(anchor).toMatchObject({ href: 'blob:log', download: 'cube.jsonl' });
    expect(append).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:log');
    vi.useRealTimers();
  });
});
