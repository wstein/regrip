import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { SmartCubeConnection, SmartCubeEvent } from 'smartcube-web-bluetooth';

import { createSmartCubeSession } from './smartCubeSession';

function connection(events$: Subject<SmartCubeEvent>): SmartCubeConnection {
  return {
    deviceName: 'GoCube',
    deviceMAC: '',
    protocol: { id: 'gocube', name: 'GoCube' },
    capabilities: { gyroscope: true, battery: false, facelets: false, hardware: false, reset: false },
    events$,
    sendCommand: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
  };
}

describe('smart cube session', () => {
  it('owns the event subscription and reprofiles before notifying event observers', async () => {
    const events$ = new Subject<SmartCubeEvent>();
    const session = createSmartCubeSession({ connect: async () => connection(events$) });
    const received: SmartCubeEvent[] = [];
    let profileAtHardware = '';
    session.subscribeEvents(event => {
      received.push(event);
      if (event.type === 'HARDWARE') profileAtHardware = session.getState().profile.id;
    });

    await session.connect();
    events$.next({ type: 'HARDWARE', timestamp: 1, hardwareName: 'GoCube' });

    expect(received).toHaveLength(1);
    expect(profileAtHardware).toBe('gocube');
    await session.disconnect();
  });
});
