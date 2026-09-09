import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';

import { createSmartCubeSession } from './smartCubeSession';
import { createJsonlMockConnection, parseJsonlCubeEvents } from './testing/jsonlMock';

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
});
