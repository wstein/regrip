import { Subject } from 'rxjs';
import type {
  SmartCubeCommand,
  SmartCubeEvent,
  SmartCubeTransportConnection,
} from '../../bindings/smartCubeTransport.js';

import { JSONL_REPLAY_FORMAT, JSONL_REPLAY_VERSION } from '../jsonlFormat.js';

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

/** Transport identity reconstructed from a replay capture. */
export type JsonlMockIdentity = {
  deviceName: string;
  deviceMAC: string;
  protocol: { id: string; name: string };
};

/** One structurally valid record from a replayable JSONL export. */
export type ValidatedJsonlEntry = Omit<JsonlEntry, 'data'> & {
  recordedAt: string;
  data: Record<string, unknown>;
};

/** Parsed capture data shared by JSONL replay consumers. */
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

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isVector(value: unknown, keys: readonly string[]): boolean {
  return isRecord(value) && keys.every((key) => isNumber(value[key]));
}

function optional(value: unknown, predicate: (value: unknown) => boolean): boolean {
  return value === undefined || predicate(value);
}

function isNumberArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isNumber);
}

function isCubieState(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNumberArray(value.CP) &&
    isNumberArray(value.CO) &&
    isNumberArray(value.EP) &&
    isNumberArray(value.EO)
  );
}

function isGoCubeType(value: unknown): boolean {
  return isRecord(value) && isNumber(value.code) && typeof value.name === 'string';
}

function isGoCubeOfflineStats(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNumber(value.moves) &&
    isNumber(value.timeSeconds) &&
    isNumber(value.solves)
  );
}

function smartCubeEventError(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.type !== 'string' || !isNumber(value.timestamp)) {
    return 'cube_event data requires string type and numeric timestamp';
  }
  switch (value.type) {
    case 'MOVE':
      return typeof value.move === 'string' &&
        isNumber(value.face) &&
        isNumber(value.direction) &&
        isNullableNumber(value.localTimestamp) &&
        isNullableNumber(value.cubeTimestamp) &&
        optional(value.serial, isNumber) &&
        optional(value.goCubeCenterOrientation, isNumber)
        ? undefined
        : 'invalid MOVE event';
    case 'FACELETS':
      return typeof value.facelets === 'string' &&
        optional(value.serial, isNumber) &&
        optional(value.state, isCubieState)
        ? undefined
        : 'invalid FACELETS event';
    case 'GYRO':
      return isVector(value.quaternion, ['x', 'y', 'z', 'w']) &&
        optional(value.velocity, (velocity) => isVector(velocity, ['x', 'y', 'z']))
        ? undefined
        : 'invalid GYRO event';
    case 'BATTERY':
      return isNumber(value.batteryLevel) ? undefined : 'invalid BATTERY event';
    case 'HARDWARE':
      return optional(value.hardwareName, (field) => typeof field === 'string') &&
        optional(value.softwareVersion, (field) => typeof field === 'string') &&
        optional(value.hardwareVersion, (field) => typeof field === 'string') &&
        optional(value.productDate, (field) => typeof field === 'string') &&
        optional(value.gyroSupported, (field) => typeof field === 'boolean') &&
        optional(value.goCubeType, isGoCubeType) &&
        optional(value.goCubeOfflineStats, isGoCubeOfflineStats)
        ? undefined
        : 'invalid HARDWARE event';
    case 'DISCONNECT':
      return undefined;
    default:
      return `unsupported cube event type ${value.type}`;
  }
}

/** Narrow an unknown JSONL payload to a supported smart-cube event. */
export function isSmartCubeEvent(value: unknown): value is SmartCubeEvent {
  return smartCubeEventError(value) === undefined;
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
    if (value.type === 'cube_event') {
      const error = smartCubeEventError(value.data);
      if (error) fail(lineNumber, error);
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
  const connection: SmartCubeTransportConnection = {
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
