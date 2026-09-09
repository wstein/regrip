import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';

import { createSmartCubeSession } from './smartCubeSession';
import {
  createJsonlMockConnection,
  JSONL_REPLAY_FORMAT,
  JSONL_REPLAY_VERSION,
  parseJsonlCubeEvents,
  validateJsonlReplay,
} from './testing/jsonlMock';

const fixtureUrl = new URL('./testing/fixtures/session-contract.jsonl', import.meta.url);

describe('JSONL session replay contract', () => {
  it('replays initial state, regrip, custom trigger, and disconnect deterministically', async () => {
    const jsonl = await readFile(fixtureUrl, 'utf8');
    const mock = createJsonlMockConnection(jsonl);
    const session = createSmartCubeSession({
      connect: async () => mock.connection,
      virtualRegrips: true,
    });
    const received: string[] = [];
    session.subscribeEvents((event) => {
      received.push(event.type === 'REGRIP' ? `REGRIP:${event.notationToken}` : event.type);
    });

    await session.connect();
    mock.replay();
    await vi.waitFor(() => expect(session.getState().status).toBe('disconnected'));

    expect(mock.sentCommands.map((command) => command.type)).toEqual([
      'REQUEST_HARDWARE',
      'REQUEST_FACELETS',
      'REQUEST_BATTERY',
    ]);
    expect(received).toMatchSnapshot();
  });

  it('ignores non-cube records from a normal app log export', () => {
    const contents = [
      '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"virtual_regrip","data":{"notationToken":"x"}}',
      '{"recordedAt":"2026-09-09T10:00:00.010Z","type":"cube_event","data":{"type":"BATTERY","timestamp":10,"batteryLevel":98}}',
    ].join('\n');

    expect(parseJsonlCubeEvents(contents)).toEqual([
      { type: 'BATTERY', timestamp: 10, batteryLevel: 98 },
    ]);
  });

  it('recognizes the current JSONL replay format header', async () => {
    const jsonl = await readFile(fixtureUrl, 'utf8');

    expect(validateJsonlReplay(jsonl).header).toEqual({
      format: JSONL_REPLAY_FORMAT,
      version: JSONL_REPLAY_VERSION,
    });
  });

  it('rejects malformed JSONL before replay with the source line number', () => {
    expect(() => validateJsonlReplay('{not json}')).toThrow('line 1: invalid JSON');
    expect(() =>
      validateJsonlReplay(
        '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"log_started","data":{"format":"smartcube-example","version":2}}',
      ),
    ).toThrow('line 1: unsupported version 2');
    expect(() =>
      validateJsonlReplay(
        '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"cube_event","data":{"type":"MOVE"}}',
      ),
    ).toThrow('line 1: cube_event data requires string type and numeric timestamp');
  });
});
