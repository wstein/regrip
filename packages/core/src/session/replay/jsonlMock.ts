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

export type JsonlMockIdentity = {
  deviceName: string;
  deviceMAC: string;
  protocol: { id: string; name: string };
};

export type ValidatedJsonlEntry = Omit<JsonlEntry, 'data'> & {
  recordedAt: string;
  data: Record<string, unknown>;
};

export type JsonlReplay = {
  entries: readonly ValidatedJsonlEntry[];
  header: JsonlReplayHeader | null;
  identity: JsonlMockIdentity;
  events: readonly SmartCubeEvent[];
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
  if (entry.type !== 'trace_header' && entry.type !== 'log_started') return null;
  const { format, version } = entry.data;
  if (format === undefined && version === undefined) return null;
  if (format !== JSONL_REPLAY_FORMAT) fail(lineNumber, `unsupported format ${String(format)}`);
  if (version !== JSONL_REPLAY_VERSION) fail(lineNumber, `unsupported version ${String(version)}`);
  return { format, version };
}

export function isSmartCubeEvent(value: unknown): value is SmartCubeEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as { type?: unknown; timestamp?: unknown };
  return typeof event.type === 'string' && typeof event.timestamp === 'number';
}

/**
 * Validate an app JSONL export before replaying it. Logs without a header are
 * accepted as legacy exports; `log_started` remains accepted for older files.
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

function identityFromEntries(entries: readonly ValidatedJsonlEntry[]): JsonlMockIdentity {
  const header = entries[0];
  const session = header && isRecord(header.data.session) ? header.data.session : undefined;
  const protocol = session && isRecord(session.protocol) ? session.protocol : undefined;
  const protocolId =
    typeof session?.protocol === 'string'
      ? session.protocol
      : typeof protocol?.id === 'string'
        ? protocol.id
        : 'jsonl-mock';
  const protocolName =
    typeof protocol?.name === 'string'
      ? protocol.name
      : protocolId === 'jsonl-mock'
        ? 'JSONL mock'
        : protocolId;
  return {
    deviceName:
      typeof session?.device === 'string'
        ? session.device
        : typeof session?.deviceName === 'string'
          ? session.deviceName
          : 'JSONL mock cube',
    deviceMAC: typeof session?.deviceMAC === 'string' ? session.deviceMAC : '',
    protocol: { id: protocolId, name: protocolName },
  };
}

/** Parse once, then share validated identity and raw events across rebuilds. */
export function createJsonlReplay(contents: string): JsonlReplay {
  const { entries, header } = validateJsonlReplay(contents);
  const events = entries.flatMap((entry) =>
    entry.type === 'cube_event' && isSmartCubeEvent(entry.data) ? [entry.data] : [],
  );
  return { entries, header, identity: identityFromEntries(entries), events };
}

/** Parse only validated raw cube events; derived UI records are ignored. */
export function parseJsonlCubeEvents(contents: string): SmartCubeEvent[] {
  return [...createJsonlReplay(contents).events];
}

/**
 * Reads capture identity from the replay header. Older, headerless exports
 * deliberately retain the generic mock identity so they remain replayable.
 */
export function readJsonlMockIdentity(contents: string): JsonlMockIdentity {
  return createJsonlReplay(contents).identity;
}

/** In-memory connection for replaying redacted JSONL exports through a session. */
export function createJsonlMockConnection(source: string | JsonlReplay) {
  const replay = typeof source === 'string' ? createJsonlReplay(source) : source;
  const { events, identity } = replay;
  const events$ = new Subject<SmartCubeEvent>();
  const sentCommands: SmartCubeCommand[] = [];
  const connection: SmartCubeConnection = {
    deviceName: identity.deviceName,
    deviceMAC: identity.deviceMAC,
    protocol: identity.protocol,
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
    identity,
    events,
    sentCommands,
    replay(options: ReplayOptions = {}): void {
      events.forEach((event, index) => {
        options.beforeEvent?.(event, index);
        events$.next(event);
      });
    },
    emit(event: SmartCubeEvent): void {
      events$.next(event);
    },
  };
}
