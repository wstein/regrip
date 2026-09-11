import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { SmartCubeEvent } from 'smartcube-web-bluetooth';

import { createSmartCubeSession } from '@wstein/regrip-core/session/smartCubeSession';
import { createSessionSignals } from './sessionSignals';

function connection(events$: Subject<SmartCubeEvent>) {
  return {
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
  };
}

describe('session signals bridge', () => {
  it('mirrors state and ordered session events without making the session reactive', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({ connect: async () => connection(events$) });
    const signals = createSessionSignals(session);

    await session.connect();
    expect(signals.state.value.status).toBe('connected');

    const battery = { type: 'BATTERY', timestamp: 1, batteryLevel: 98 } as const;
    const received: unknown[] = [];
    const unsubscribeEvents = signals.event.subscribe((event) => {
      if (event) received.push(event);
    });
    events$.next(battery);
    events$.next(battery);
    expect(signals.event.value).toMatchObject({ type: 'BATTERY', batteryLevel: 98 });
    expect(received).toHaveLength(2);

    unsubscribeEvents();
    signals.dispose();
    await session.disconnect();
    expect(signals.state.value.status).toBe('connected');
  });
});
