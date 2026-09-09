import { Subject } from 'rxjs';
import type {
  SmartCubeCommand,
  SmartCubeConnection,
  SmartCubeEvent,
} from 'smartcube-web-bluetooth';

type JsonlEntry = { type: string; data: unknown };

function isSmartCubeEvent(value: unknown): value is SmartCubeEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as { type?: unknown; timestamp?: unknown };
  return typeof event.type === 'string' && typeof event.timestamp === 'number';
}

/** Parse only raw cube events from an app JSONL export; derived UI records are ignored. */
export function parseJsonlCubeEvents(contents: string): SmartCubeEvent[] {
  const events: SmartCubeEvent[] = [];
  for (const line of contents.split('\n')) {
    if (line.trim() === '') continue;
    const entry = JSON.parse(line) as JsonlEntry;
    if (entry.type === 'cube_event' && isSmartCubeEvent(entry.data)) events.push(entry.data);
  }
  return events;
}

/** In-memory connection for replaying redacted JSONL exports through a session. */
export function createJsonlMockConnection(contents: string) {
  const events = parseJsonlCubeEvents(contents);
  const events$ = new Subject<SmartCubeEvent>();
  const sentCommands: SmartCubeCommand[] = [];
  const connection: SmartCubeConnection = {
    deviceName: 'JSONL mock cube',
    deviceMAC: '',
    protocol: { id: 'jsonl-mock', name: 'JSONL mock' },
    capabilities: { gyroscope: true, battery: true, facelets: true, hardware: true, reset: true },
    events$,
    sendCommand: async (command) => {
      sentCommands.push(command);
    },
    disconnect: async () => {
      events$.complete();
    },
  };

  return {
    connection,
    events,
    sentCommands,
    replay(): void {
      events.forEach((event) => events$.next(event));
    },
  };
}
