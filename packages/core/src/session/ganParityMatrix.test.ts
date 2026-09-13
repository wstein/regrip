import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type {
  SmartCubeCapabilities,
  SmartCubeCommand,
  SmartCubeEvent,
} from '../bindings/smartCubeTransport';
import { createSmartCubeSession } from './smartCubeSession';

const fullCapabilities: SmartCubeCapabilities = {
  gyroscope: true,
  battery: true,
  facelets: true,
  hardware: true,
  reset: true,
};

const matrix = [
  {
    generation: 1,
    protocol: 'gan-gen1',
    deviceName: 'GAN356 i Carry',
    profile: 'gan-gen2',
    capabilities: { ...fullCapabilities, hardware: false, reset: false },
    initialCommands: ['REQUEST_FACELETS', 'REQUEST_BATTERY'],
  },
  {
    generation: 2,
    protocol: 'gan-gen2',
    deviceName: 'GAN12 ui',
    profile: 'gan-gen2',
    capabilities: fullCapabilities,
    initialCommands: ['REQUEST_HARDWARE', 'REQUEST_FACELETS', 'REQUEST_BATTERY'],
  },
  {
    generation: 3,
    protocol: 'gan-gen3',
    deviceName: 'GAN12 ui FreePlay',
    profile: 'gan-gen2',
    capabilities: fullCapabilities,
    initialCommands: ['REQUEST_HARDWARE', 'REQUEST_FACELETS', 'REQUEST_BATTERY'],
  },
  {
    generation: 4,
    protocol: 'gan-gen4',
    deviceName: 'GANi4_REDACTED',
    profile: 'gan-gen4',
    capabilities: fullCapabilities,
    initialCommands: ['REQUEST_HARDWARE', 'REQUEST_FACELETS', 'REQUEST_BATTERY'],
  },
] as const;

describe('GAN generation parity matrix', () => {
  for (const row of matrix) {
    it(`Gen${row.generation} resolves its profile and common session contract`, async () => {
      const events$ = new Subject<SmartCubeEvent>();
      const sendCommand = vi.fn<(command: SmartCubeCommand) => Promise<void>>(async () => {});
      const disconnect = vi.fn(async () => {});
      const session = createSmartCubeSession({
        connect: async () => ({
          deviceName: row.deviceName,
          deviceMAC: row.generation === 1 ? '' : '00:11:22:33:44:55',
          protocol: { id: row.protocol, name: `GAN Gen${row.generation}` },
          capabilities: row.capabilities,
          events$,
          sendCommand,
          disconnect,
        }),
      });
      const received: string[] = [];
      session.subscribeEvents((event) => received.push(event.type));

      await session.connect();
      events$.next({ type: 'BATTERY', timestamp: 1, batteryLevel: 87 });
      events$.next({
        type: 'MOVE',
        timestamp: 2,
        move: 'R',
        face: 1,
        direction: 0,
        localTimestamp: 2,
        cubeTimestamp: 2,
      });

      expect(session.getState()).toMatchObject({
        status: 'connected',
        profile: { id: row.profile },
      });
      expect(sendCommand.mock.calls.map(([command]) => command.type)).toEqual(row.initialCommands);
      expect(received).toEqual(['BATTERY', 'MOVE']);

      await session.disconnect();
      expect(disconnect).toHaveBeenCalledOnce();
    });
  }
});
