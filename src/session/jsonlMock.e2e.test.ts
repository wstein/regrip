import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';

import { createSmartCubeSession } from './smartCubeSession';
import {
  createJsonlMockConnection,
  JSONL_REPLAY_FORMAT,
  JSONL_REPLAY_VERSION,
  parseJsonlCubeEvents,
  readJsonlMockIdentity,
  validateJsonlReplay,
} from './testing/jsonlMock';

const fixtureUrl = new URL('./testing/fixtures/session-contract.jsonl', import.meta.url);
const uiFixtures = [
  new URL('./testing/fixtures/gocube-edge-ui.jsonl', import.meta.url),
  new URL('./testing/fixtures/gan-ui12-ui.jsonl', import.meta.url),
];

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

  it('replays pure detector state deterministically across recorded feature changes', async () => {
    const replay = async (): Promise<string[]> => {
      const jsonl = await readFile(fixtureUrl, 'utf8');
      const mock = createJsonlMockConnection(jsonl);
      const session = createSmartCubeSession({
        connect: async () => mock.connection,
        features: { regrip: { enabled: false }, customTrigger: { enabled: false } },
      });
      const received: string[] = [];
      session.subscribeEvents((event) => {
        received.push(event.type === 'REGRIP' ? `REGRIP:${event.notationToken}` : event.type);
      });

      await session.connect();
      mock.replay({
        beforeEvent(event) {
          if (event.type === 'GYRO' && event.timestamp === 40) {
            session.configureFeatures({ regrip: { enabled: true } });
          }
          if (event.type === 'MOVE' && event.timestamp === 1000) {
            session.configureFeatures({ customTrigger: { enabled: true } });
          }
        },
      });
      await vi.waitFor(() => expect(session.getState().status).toBe('disconnected'));
      return received;
    };

    const first = await replay();
    const second = await replay();

    expect(first).toEqual(second);
    expect(first).toEqual([
      'HARDWARE',
      'BATTERY',
      'FACELETS',
      'GYRO',
      'GYRO',
      "REGRIP:x'",
      'MOVE',
      'MOVE',
      'CUSTOM_TRIGGER',
      'DISCONNECT',
    ]);
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

  it('keeps the GoCube Edge and GAN UI12 screenshot fixtures replayable', async () => {
    for (const fixture of uiFixtures) {
      const contents = await readFile(fixture, 'utf8');
      expect(validateJsonlReplay(contents).header).toEqual({
        format: JSONL_REPLAY_FORMAT,
        version: JSONL_REPLAY_VERSION,
      });
      expect(parseJsonlCubeEvents(contents)).not.toHaveLength(0);
    }
  });

  it('uses capture identity so replay resolves the matching device profile', async () => {
    const [gocube, gan] = await Promise.all(uiFixtures.map((fixture) => readFile(fixture, 'utf8')));

    expect(readJsonlMockIdentity(gocube)).toMatchObject({
      deviceName: 'GoCube Edge',
      protocol: { id: 'gocube' },
    });
    expect(createJsonlMockConnection(gan).connection).toMatchObject({
      deviceName: 'GAN12 UI',
      protocol: { id: 'gan-gen2' },
    });
  });

  it('rejects malformed JSONL before replay with the source line number', () => {
    expect(() => validateJsonlReplay('{not json}')).toThrow('line 1: invalid JSON');
    expect(() =>
      validateJsonlReplay(
        '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"log_started","data":{"format":"regrip","version":2}}',
      ),
    ).toThrow('line 1: unsupported version 2');
    expect(() =>
      validateJsonlReplay(
        '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"cube_event","data":{"type":"MOVE"}}',
      ),
    ).toThrow('line 1: cube_event data requires string type and numeric timestamp');
  });
});
