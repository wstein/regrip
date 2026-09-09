import { afterEach, describe, expect, it, vi } from 'vitest';

import { createJsonlLog, downloadJsonl } from './jsonlLog';

afterEach(() => vi.unstubAllGlobals());

describe('JSONL log', () => {
  it('keeps a local buffer and exports its current entries with a replay header', () => {
    const log = createJsonlLog(() => '2026-09-08T12:00:00.000Z');
    log.record('session_status', { status: 'connected' });
    log.record('cube_event', { type: 'BATTERY', batteryLevel: 98 });
    const lines = log
      .toJsonl({ format: 'regrip', version: 1, profile: 'gocube' })
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(lines).toEqual([
      {
        recordedAt: '2026-09-08T12:00:00.000Z',
        type: 'trace_header',
        data: { format: 'regrip', version: 1, profile: 'gocube' },
      },
      {
        recordedAt: '2026-09-08T12:00:00.000Z',
        type: 'session_status',
        data: { status: 'connected' },
      },
      {
        recordedAt: '2026-09-08T12:00:00.000Z',
        type: 'cube_event',
        data: { type: 'BATTERY', batteryLevel: 98 },
      },
    ]);
  });

  it('notifies the live trace for every local entry and clears the export buffer', () => {
    const log = createJsonlLog(() => '2026-09-08T12:00:00.000Z');
    const seen: string[] = [];
    log.subscribe((entry) => seen.push(entry.type));

    log.record('session_status', {});
    log.record('cube_event', { type: 'MOVE', move: 'R' });

    expect(seen).toEqual(['session_status', 'cube_event']);
    log.clear();
    expect(log.toJsonl({ format: 'regrip', version: 1 }).trim()).toBe(
      '{"recordedAt":"2026-09-08T12:00:00.000Z","type":"trace_header","data":{"format":"regrip","version":1}}',
    );
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
