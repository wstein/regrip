import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { SmartCubeDiagnosticEvent, SmartCubeEvent } from 'smartcube-web-bluetooth';

import { createCubeEventController } from '../integration/cubeEvents';
import { createSmartCubeSession } from '@wstein/regrip-core/session/smartCubeSession';
import { createJsonlLog, type LogEntry } from './jsonlLog';
import { describeLogEntry } from './liveLog';

describe('future transport event handling', () => {
  it('captures and exposes a future event without changing cube state', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({
      connect: async () => ({
        deviceName: 'Mock Cube',
        deviceMAC: '',
        protocol: { id: 'mock', name: 'Mock' },
        capabilities: {
          gyroscope: false,
          battery: false,
          facelets: false,
          hardware: false,
          reset: false,
        },
        events$,
        sendCommand: vi.fn(async () => {}),
        disconnect: vi.fn(async () => {}),
      }),
    });
    const timer = { dispatch: vi.fn(), onMove: vi.fn(), reset: vi.fn(), refresh: vi.fn() };
    const addMove = vi.fn();
    const setOrientation = vi.fn();
    const setPlayerAlgorithm = vi.fn();
    const setInfo = vi.fn();
    const showInfo = vi.fn();
    const onUnknownEvent = vi.fn();
    const cubeEvents = createCubeEventController({
      timer,
      solveScramble: async () => '',
      addMove,
      setOrientation,
      setPlayerAlgorithm,
      setInfo,
      showInfo,
      onDisconnect: vi.fn(),
      onSolved: vi.fn(),
      onUnknownEvent,
    });
    const log = createJsonlLog(() => '2026-09-11T10:00:00.000Z');
    const captured: LogEntry[] = [];
    log.subscribe((entry) => captured.push(entry));
    session.subscribeEvents((event) => {
      log.record('cube_event', event as unknown as Record<string, unknown>);
      cubeEvents.handle(event as unknown as Parameters<typeof cubeEvents.handle>[0]);
    });
    const future = { type: 'FUTURE_EVENT', timestamp: 1, payload: { mode: 7 } };

    await session.connect();
    events$.next(future as unknown as SmartCubeEvent);

    expect(captured).toEqual([
      {
        recordedAt: '2026-09-11T10:00:00.000Z',
        type: 'cube_event',
        data: future,
      },
    ]);
    expect(describeLogEntry(captured[0]!)).toEqual(['UNKNOWN', 'unknown event · FUTURE_EVENT']);
    expect(onUnknownEvent).toHaveBeenCalledWith(future);
    expect(timer.onMove).not.toHaveBeenCalled();
    expect(addMove).not.toHaveBeenCalled();
    expect(setOrientation).not.toHaveBeenCalled();
    expect(setPlayerAlgorithm).not.toHaveBeenCalled();
    expect(setInfo).not.toHaveBeenCalled();
    expect(showInfo).not.toHaveBeenCalled();
    await session.disconnect();
  });

  it('routes raw diagnostics only to the diagnostic observer, never event reducers', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const diagnostics$ = new Subject<SmartCubeDiagnosticEvent>();
    const session = createSmartCubeSession({
      connect: async () => ({
        deviceName: 'Mock Cube',
        deviceMAC: '',
        protocol: { id: 'mock', name: 'Mock' },
        capabilities: {
          gyroscope: false,
          battery: false,
          facelets: false,
          hardware: false,
          reset: false,
        },
        events$,
        diagnostics$,
        sendCommand: vi.fn(async () => {}),
        disconnect: vi.fn(async () => {}),
      }),
    });
    const handleEvent = vi.fn();
    const diagnostics: SmartCubeDiagnosticEvent[] = [];
    session.subscribeEvents(handleEvent);
    session.subscribeDiagnostics((diagnostic) => diagnostics.push(diagnostic));

    await session.connect();
    const diagnostic: SmartCubeDiagnosticEvent = {
      type: 'UNKNOWN_PACKET',
      protocol: 'qiyi',
      timestamp: 1,
      opcode: 0xfe,
      bytes: [0x55, 0xfe],
    };
    diagnostics$.next(diagnostic);

    expect(diagnostics).toEqual([diagnostic]);
    expect(handleEvent).not.toHaveBeenCalled();
    expect(session.getState().lastEvent).toBeNull();
    await session.disconnect();
  });
});
