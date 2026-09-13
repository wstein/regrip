import type {
  SmartCubeSessionDiagnostic,
  SmartCubeSessionEvent,
} from '@wstein/regrip-core/session/smartCubeSession';
import type { LogEntry } from './jsonlLog';

export type TraceCategory =
  | 'MOVE'
  | 'EVENT'
  | 'STATE'
  | 'COMMAND'
  | 'UNKNOWN'
  | 'DIAGNOSTIC'
  | 'GYRO'
  | 'REGRIP'
  | 'TRIGGER'
  | 'SHAKE';

export type TraceEntry = {
  id: number;
  category: TraceCategory;
  message: string;
  log: LogEntry;
};

export type TraceChip = { label: string; value: string };
type TraceData = Record<string, unknown>;
type EventDescriptor = {
  category: TraceCategory;
  summarize: (data: TraceData, logType?: string) => string;
  chips?: (data: TraceData, message: string) => TraceChip[];
};

function hardwareSummary(data: TraceData): string {
  const name = typeof data.hardwareName === 'string' ? data.hardwareName : 'hardware';
  const details = [
    typeof data.hardwareVersion === 'string' ? `HW ${data.hardwareVersion}` : undefined,
    typeof data.softwareVersion === 'string' ? `SW ${data.softwareVersion}` : undefined,
  ].filter((value): value is string => value !== undefined);
  return details.length > 0 ? `${name} · ${details.join(' · ')}` : name;
}

function faceletsSummary(data: TraceData): string {
  const serial = typeof data.serial === 'number' ? ` #${data.serial}` : '';
  const stickers = typeof data.facelets === 'string' ? ` · ${data.facelets.length} stickers` : '';
  return `facelets${serial}${stickers}`;
}

function hexBytes(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

const stateChips = (data: TraceData, message: string): TraceChip[] => [
  {
    label: 'State',
    value:
      typeof data.status === 'string'
        ? data.status
        : typeof data.state === 'string'
          ? data.state
          : message,
  },
  ...(typeof data.profile === 'string' ? [{ label: 'Profile', value: data.profile }] : []),
];

const eventDescriptorDefinitions = {
  MOVE: {
    category: 'MOVE',
    summarize: (data) => String(data.move),
    chips: (data, message) => {
      const chips: TraceChip[] = [
        { label: 'Move', value: typeof data.move === 'string' ? data.move : message },
      ];
      if (typeof data.face === 'string') chips.push({ label: 'Face', value: data.face });
      if (typeof data.turns === 'number') chips.push({ label: 'Turns', value: String(data.turns) });
      if (typeof data.amount === 'number')
        chips.push({ label: 'Amount', value: String(data.amount) });
      return chips;
    },
  },
  GYRO: {
    category: 'GYRO',
    summarize: (data, logType) => {
      if (logType === 'gyro_stabilizer') return 'stabilized gyro';
      if (!data.quaternion || typeof data.quaternion !== 'object') return 'gyro';
      const quaternion = data.quaternion as TraceData;
      if (
        typeof quaternion.x !== 'number' ||
        typeof quaternion.y !== 'number' ||
        typeof quaternion.z !== 'number'
      )
        return 'gyro';
      return `q ${quaternion.x.toFixed(2)}, ${quaternion.y.toFixed(2)}, ${quaternion.z.toFixed(2)}`;
    },
  },
  REGRIP: {
    category: 'REGRIP',
    summarize: (data) => {
      const token = typeof data.solverToken === 'string' ? data.solverToken : data.notationToken;
      return `${String(token)} (${String(data.sensorFrameToken)})`;
    },
    chips: (data, message) => [
      {
        label: 'Regrip',
        value:
          typeof data.solverToken === 'string'
            ? data.solverToken
            : typeof data.notationToken === 'string'
              ? data.notationToken
              : message,
      },
      ...(typeof data.sensorFrameToken === 'string'
        ? [{ label: 'Sensor', value: data.sensorFrameToken }]
        : []),
    ],
  },
  CUSTOM_TRIGGER: {
    category: 'TRIGGER',
    summarize: (data) => String(data.move),
    chips: (data, message) => [
      { label: 'Trigger', value: typeof data.move === 'string' ? data.move : message },
    ],
  },
  SHAKE: {
    category: 'SHAKE',
    summarize: (data) => `${String(data.steps)} steps, ${String(data.reversals)} reversals`,
    chips: (data) => [
      { label: 'Gesture', value: 'Shake' },
      ...(typeof data.steps === 'number' ? [{ label: 'Steps', value: String(data.steps) }] : []),
      ...(typeof data.reversals === 'number'
        ? [{ label: 'Reversals', value: String(data.reversals) }]
        : []),
    ],
  },
  MOVE_GAP: {
    category: 'STATE',
    summarize: (data) => `${String(data.missing)} missed move${data.missing === 1 ? '' : 's'}`,
    chips: stateChips,
  },
  BATTERY: { category: 'EVENT', summarize: (data) => `battery ${String(data.batteryLevel)}%` },
  HARDWARE: { category: 'EVENT', summarize: hardwareSummary },
  FACELETS: { category: 'EVENT', summarize: faceletsSummary },
  DISCONNECT: { category: 'STATE', summarize: () => 'cube disconnected', chips: stateChips },
  session_status: {
    category: 'STATE',
    summarize: (data) => String(data.status),
    chips: stateChips,
  },
  log_started: { category: 'STATE', summarize: () => 'recording started', chips: stateChips },
  log_stopped: {
    category: 'STATE',
    summarize: (data) => `recording stopped · ${String(data.entries)} events`,
    chips: stateChips,
  },
  profile_selected: { category: 'EVENT', summarize: (data) => `profile ${String(data.id)}` },
  cube_command: {
    category: 'COMMAND',
    summarize: (data) => {
      const name = typeof data.name === 'string' ? data.name : 'cube command';
      const status = typeof data.status === 'string' ? ` · ${data.status}` : '';
      const reason = typeof data.reason === 'string' ? ` · ${data.reason.replace(/_/g, ' ')}` : '';
      return `${name}${status}${reason}`;
    },
    chips: (data) => [
      ...(typeof data.name === 'string' ? [{ label: 'Command', value: data.name }] : []),
      ...(typeof data.status === 'string' ? [{ label: 'Status', value: data.status }] : []),
    ],
  },
  transport_diagnostic: {
    category: 'DIAGNOSTIC',
    summarize: (data) => {
      const protocol = typeof data.protocol === 'string' ? data.protocol : 'transport';
      const opcode = typeof data.opcode === 'number' ? ` opcode 0x${data.opcode.toString(16)}` : '';
      const bytes = Array.isArray(data.bytes)
        ? data.bytes.filter((byte): byte is number => typeof byte === 'number')
        : [];
      const originalLength = typeof data.byteLength === 'number' ? data.byteLength : bytes.length;
      const suffix = data.truncated === true ? ' (truncated)' : '';
      return `${protocol}${opcode} · ${originalLength} bytes · ${hexBytes(bytes)}${suffix}`;
    },
  },
} satisfies Record<SmartCubeSessionEvent['type'], EventDescriptor> &
  Record<string, EventDescriptor>;
const eventDescriptors: Record<string, EventDescriptor> = eventDescriptorDefinitions;

const logDescriptorAliases: Record<string, string> = {
  virtual_regrip: 'REGRIP',
  custom_trigger: 'CUSTOM_TRIGGER',
  shake_trigger: 'SHAKE',
  move_gap: 'MOVE_GAP',
  gyro_stabilizer: 'GYRO',
};

function descriptorForLogEntry(entry: LogEntry): EventDescriptor | undefined {
  const data = entry.data as TraceData;
  if (entry.type === 'cube_event') {
    return typeof data.type === 'string' ? eventDescriptors[data.type] : undefined;
  }
  const key = logDescriptorAliases[entry.type] ?? entry.type;
  return (
    eventDescriptors[key] ??
    (typeof data.type === 'string' ? eventDescriptors[data.type] : undefined)
  );
}

export function extractTraceChips(entry: TraceEntry): TraceChip[] {
  const data = (entry.log.data as TraceData | undefined) ?? {};
  const descriptor = descriptorForLogEntry(entry.log);
  const chips = descriptor?.chips?.(data, entry.message) ?? [];
  if (!descriptor && entry.category === 'MOVE') {
    chips.push({ label: 'Move', value: typeof data.move === 'string' ? data.move : entry.message });
  }
  if (typeof data.batteryLevel === 'number')
    chips.push({ label: 'Battery', value: `${data.batteryLevel}%` });
  else if (typeof data.battery === 'number')
    chips.push({ label: 'Battery', value: `${data.battery}%` });
  if (typeof data.hardwareName === 'string')
    chips.push({ label: 'Hardware', value: data.hardwareName });
  if (Array.isArray(data.facelets))
    chips.push({ label: 'Facelets', value: `${data.facelets.length} stickers` });
  else if (typeof data.facelets === 'string')
    chips.push({ label: 'Facelets', value: `${data.facelets.length} stickers` });
  if (data.quaternion && typeof data.quaternion === 'object') {
    const q = data.quaternion as Record<string, number>;
    if (typeof q.x === 'number' && typeof q.y === 'number' && typeof q.z === 'number') {
      chips.push({
        label: 'Quat',
        value: `[${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(2)}]`,
      });
    }
  }
  if (typeof data.opcode === 'number')
    chips.push({ label: 'Opcode', value: `0x${data.opcode.toString(16).padStart(2, '0')}` });
  if (Array.isArray(data.bytes)) chips.push({ label: 'Payload', value: `${data.bytes.length} B` });
  return chips;
}

export function describeDiagnostic(event: SmartCubeSessionDiagnostic): string {
  const opcode = event.opcode === undefined ? '' : ` opcode 0x${event.opcode.toString(16)}`;
  return `${event.protocol}${opcode} · ${event.bytes.length} bytes · ${hexBytes(event.bytes)}`;
}

export function describeLogEntry(entry: LogEntry): [TraceCategory, string] {
  const data = entry.data as TraceData;
  const descriptor = descriptorForLogEntry(entry);
  if (descriptor) return [descriptor.category, descriptor.summarize(data, entry.type)];
  if (entry.type === 'cube_event') {
    return [
      'UNKNOWN',
      typeof data.type === 'string' ? `unknown event · ${data.type}` : 'unknown cube event',
    ];
  }
  return ['EVENT', entry.type.replace(/_/g, ' ')];
}
