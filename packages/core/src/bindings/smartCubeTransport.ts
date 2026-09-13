import type {
  SmartCubeBatteryEvent as StockSmartCubeBatteryEvent,
  SmartCubeCapabilities as StockSmartCubeCapabilities,
  SmartCubeCommand,
  SmartCubeConnection as StockSmartCubeConnection,
  SmartCubeDisconnectEvent as StockSmartCubeDisconnectEvent,
  SmartCubeFaceletsEvent as StockSmartCubeFaceletsEvent,
  SmartCubeGyroEvent as StockSmartCubeGyroEvent,
  SmartCubeHardwareEvent as StockSmartCubeHardwareEvent,
  SmartCubeMoveEvent as StockSmartCubeMoveEvent,
  SmartCubeProtocolInfo,
} from 'smartcube-web-bluetooth';
import type { Observable } from 'rxjs';

/** Cubie coordinates optionally supplied by enhanced transports. */
export type SmartCubeCubieState = {
  CP: number[];
  CO: number[];
  EP: number[];
  EO: number[];
};

export type GoCubeType = { code: number; name: string };

export type GoCubeOfflineStats = {
  moves: number;
  timeSeconds: number;
  solves: number;
};

export type SmartCubeVendorCommand =
  | { vendor: 'gocube'; type: 'REBOOT' }
  | { vendor: 'gocube'; type: 'SET_ORIENTATION_ENABLED'; enabled: boolean }
  | { vendor: 'gocube'; type: 'CALIBRATE_ORIENTATION' }
  | { vendor: 'gocube'; type: 'FLASH_BACKLIGHT' }
  | { vendor: 'gocube'; type: 'SLOW_FLASH_BACKLIGHT' }
  | { vendor: 'gocube'; type: 'TOGGLE_ANIMATED_BACKLIGHT' }
  | { vendor: 'gocube'; type: 'TOGGLE_BACKLIGHT' };

/** Optional decoder diagnostic exposed by enhanced transports. */
export type SmartCubeDiagnosticEvent = {
  type: 'RAW_PACKET' | 'DECODED_PACKET' | 'MALFORMED_PACKET' | 'UNKNOWN_PACKET';
  protocol: string;
  timestamp: number;
  opcode?: number;
  bytes: readonly number[];
  reason?: string;
};

type Timestamped = { timestamp: number };

export type SmartCubeMoveEvent = StockSmartCubeMoveEvent &
  Timestamped & {
    serial?: number;
    goCubeCenterOrientation?: number;
  };

export type SmartCubeFaceletsEvent = StockSmartCubeFaceletsEvent &
  Timestamped & {
    serial?: number;
    state?: SmartCubeCubieState;
  };

export type SmartCubeGyroEvent = StockSmartCubeGyroEvent & Timestamped;
export type SmartCubeBatteryEvent = StockSmartCubeBatteryEvent & Timestamped;
export type SmartCubeHardwareEvent = StockSmartCubeHardwareEvent &
  Timestamped & {
    goCubeType?: GoCubeType;
    goCubeOfflineStats?: GoCubeOfflineStats;
  };
export type SmartCubeDisconnectEvent = StockSmartCubeDisconnectEvent & Timestamped;

/** Stock v4 events plus optional metadata supplied by compatible enhanced transports. */
export type SmartCubeEvent =
  | SmartCubeMoveEvent
  | SmartCubeFaceletsEvent
  | SmartCubeGyroEvent
  | SmartCubeBatteryEvent
  | SmartCubeHardwareEvent
  | SmartCubeDisconnectEvent;

export type SmartCubeCapabilities = StockSmartCubeCapabilities & {
  vendorCommands?: readonly SmartCubeVendorCommand['type'][];
};

/**
 * Transport boundary consumed by the core session.
 *
 * The stock smartcube-web-bluetooth v4 connection satisfies this contract.
 * Enhanced transports may additionally expose diagnostics, vendor commands,
 * serial counters, cubie coordinates, and GoCube metadata.
 */
export type SmartCubeTransportConnection = {
  readonly deviceName: string;
  readonly deviceMAC: string;
  readonly protocol: SmartCubeProtocolInfo;
  readonly capabilities: SmartCubeCapabilities;
  events$: Observable<SmartCubeEvent>;
  /** Decoder diagnostics remain separate from cube-state session events. */
  diagnostics$?: Observable<SmartCubeDiagnosticEvent>;
  sendCommand: (command: SmartCubeCommand) => Promise<void>;
  sendVendorCommand?: (command: SmartCubeVendorCommand) => Promise<void>;
  disconnect: () => Promise<void>;
};

type ConnectionSatisfiesTransport = StockSmartCubeConnection extends SmartCubeTransportConnection
  ? true
  : false;

// Fails type-checking if stock smartcube-web-bluetooth breaks the adapter contract.
const connectionSatisfiesTransport: ConnectionSatisfiesTransport = true;
void connectionSatisfiesTransport;

export type { SmartCubeCommand, SmartCubeProtocolInfo };
