import { describe, expect, it } from 'vitest';

import { replayHeaderForState, scopedTraceJsonl } from './traceExport';

const entry = { recordedAt: 'event-time', type: 'cube_event', data: { type: 'MOVE' } };

describe('trace export', () => {
  it('builds a replay header from current session identity', () => {
    expect(
      replayHeaderForState({
        status: 'disconnected',
        connection: null,
        lastEvent: null,
        error: null,
        profile: { id: 'unknown', value: { id: 'unknown' }, sources: {} },
        features: {} as never,
      }),
    ).toMatchObject({
      format: 'regrip',
      version: 1,
      session: { status: 'disconnected', device: null, profile: 'unknown' },
    });
  });

  it('routes all, filtered, and selected scopes without duplicating serialization', () => {
    const common = {
      header: { format: 'regrip' },
      all: () => 'all-jsonl\n',
      filtered: [entry],
      selected: [entry],
      now: () => 'header-time',
    };
    expect(scopedTraceJsonl({ ...common, scope: 'all' })).toEqual({ contents: 'all-jsonl\n' });
    expect(scopedTraceJsonl({ ...common, scope: 'filtered' }).contents).toContain('header-time');
    expect(scopedTraceJsonl({ ...common, scope: 'selected' }).contents).toContain('cube_event');
    expect(scopedTraceJsonl({ ...common, scope: 'selected', selected: [] })).toEqual({
      error: 'Select trace events first.',
    });
  });
});
