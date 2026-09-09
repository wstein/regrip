import { afterEach, describe, expect, it, vi } from 'vitest';

import { createJsonlLog, downloadJsonl } from './jsonlLog';

afterEach(() => vi.unstubAllGlobals());

describe('JSONL log', () => {
  it('keeps a local buffer but exports only the range marked by start and stop', () => {
    const log = createJsonlLog(() => '2026-09-08T12:00:00.000Z');
    log.record('before_recording', {});
    log.start({ profile: 'gocube' });
    log.record('cube_event', { type: 'BATTERY', batteryLevel: 98 });
    const lines = log
      .stop()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(lines).toEqual([
      { recordedAt: '2026-09-08T12:00:00.000Z', type: 'log_started', data: { profile: 'gocube' } },
      {
        recordedAt: '2026-09-08T12:00:00.000Z',
        type: 'cube_event',
        data: { type: 'BATTERY', batteryLevel: 98 },
      },
      { recordedAt: '2026-09-08T12:00:00.000Z', type: 'log_stopped', data: { entries: 1 } },
    ]);
  });

  it('notifies the live trace for every local entry and reports the recording count', () => {
    const log = createJsonlLog(() => '2026-09-08T12:00:00.000Z');
    const seen: Array<[string, number]> = [];
    log.subscribe((entry, count) => seen.push([entry.type, count]));

    log.record('before_recording', {});
    log.start({ profile: 'gocube' });
    log.record('cube_event', { type: 'MOVE', move: 'R' });

    expect(seen).toEqual([
      ['before_recording', 0],
      ['log_started', 0],
      ['cube_event', 1],
    ]);
    expect(log.recordingCount).toBe(1);
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
