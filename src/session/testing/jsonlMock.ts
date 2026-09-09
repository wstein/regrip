import { Subject } from 'rxjs';
import type {
  SmartCubeCommand,
  SmartCubeConnection,
  SmartCubeEvent,
} from 'smartcube-web-bluetooth';

import { JSONL_REPLAY_FORMAT, JSONL_REPLAY_VERSION } from '../jsonlFormat';

type JsonlEntry = { type: string; data: unknown };
type ReplayOptions = {
  /** Invoked in recorded order immediately before a mock event is delivered. */
  beforeEvent?: (event: SmartCubeEvent, index: number) => void;
};

export { JSONL_REPLAY_FORMAT, JSONL_REPLAY_VERSION };

type JsonlReplayHeader = {
  format: typeof JSONL_REPLAY_FORMAT;
  version: typeof JSONL_REPLAY_VERSION;
};

type ValidatedJsonlEntry = Omit<JsonlEntry, 'data'> & {
  recordedAt: string;
  data: Record<string, unknown>;
};

function fail(lineNumber: number, message: string): never {
  throw new Error(`Invalid JSONL replay input at line ${lineNumber}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJsonlEntry(value: unknown): value is ValidatedJsonlEntry {
  return (
    isRecord(value) &&
    typeof value.recordedAt === 'string' &&
    typeof value.type === 'string' &&
    isRecord(value.data)
  );
}

function readHeader(entry: ValidatedJsonlEntry, lineNumber: number): JsonlReplayHeader | null {
  if (entry.type !== 'log_started') return null;
  const { format, version } = entry.data;
  if (format === undefined && version === undefined) return null;
  if (format !== JSONL_REPLAY_FORMAT) fail(lineNumber, `unsupported format ${String(format)}`);
  if (version !== JSONL_REPLAY_VERSION) fail(lineNumber, `unsupported version ${String(version)}`);
  return { format, version };
}

function isSmartCubeEvent(value: unknown): value is SmartCubeEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as { type?: unknown; timestamp?: unknown };
  return typeof event.type === 'string' && typeof event.timestamp === 'number';
}

/**
 * Validate an app JSONL export before replaying it. Logs without a `log_started`
 * format header are accepted as legacy exports; all new recordings use v1.
 */
export function validateJsonlReplay(contents: string): {
  entries: readonly ValidatedJsonlEntry[];
  header: JsonlReplayHeader | null;
} {
  const entries: ValidatedJsonlEntry[] = [];
  let header: JsonlReplayHeader | null = null;

  for (const [index, line] of contents.split('\n').entries()) {
    if (line.trim() === '') continue;
    const lineNumber = index + 1;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      fail(lineNumber, 'invalid JSON');
    }
    if (!isJsonlEntry(value)) fail(lineNumber, 'expected { recordedAt, type, data } record');
    if (entries.length === 0) header = readHeader(value, lineNumber);
    if (value.type === 'cube_event' && !isSmartCubeEvent(value.data)) {
      fail(lineNumber, 'cube_event data requires string type and numeric timestamp');
    }
    entries.push(value);
  }

  return { entries, header };
}

/** Parse only validated raw cube events; derived UI records are ignored. */
export function parseJsonlCubeEvents(contents: string): SmartCubeEvent[] {
  const events: SmartCubeEvent[] = [];
  for (const entry of validateJsonlReplay(contents).entries) {
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
    replay(options: ReplayOptions = {}): void {
      events.forEach((event, index) => {
        options.beforeEvent?.(event, index);
        events$.next(event);
      });
    },
  };
}
