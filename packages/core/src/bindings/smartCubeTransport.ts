import type {
  SmartCubeCapabilities,
  SmartCubeCommand,
  SmartCubeConnection,
  SmartCubeEvent,
  SmartCubeProtocolInfo,
  SmartCubeVendorCommand,
} from 'smartcube-web-bluetooth';
import type { Observable } from 'rxjs';

/**
 * Transport boundary consumed by the core session.
 *
 * The Web-Bluetooth implementation satisfies this contract today. CubeLab can
 * satisfy the same contract with its temporary legacy-driver adapter during the
 * GAN and GoCube migration, without leaking a concrete BLE connection into the
 * session API.
 */
export type SmartCubeTransportConnection = {
  deviceName: string;
  deviceMAC: string;
  protocol: SmartCubeProtocolInfo;
  capabilities: SmartCubeCapabilities;
  events$: Observable<SmartCubeEvent>;
  sendCommand: (command: SmartCubeCommand) => Promise<void>;
  sendVendorCommand?: (command: SmartCubeVendorCommand) => Promise<void>;
  disconnect: () => Promise<void>;
};

type ConnectionSatisfiesTransport = SmartCubeConnection extends SmartCubeTransportConnection
  ? true
  : false;

// Fails type-checking if a smartcube-web-bluetooth upgrade breaks the adapter
// contract relied upon by the core session.
const connectionSatisfiesTransport: ConnectionSatisfiesTransport = true;
void connectionSatisfiesTransport;

export type {
  SmartCubeCapabilities,
  SmartCubeCommand,
  SmartCubeEvent,
  SmartCubeProtocolInfo,
  SmartCubeVendorCommand,
};
