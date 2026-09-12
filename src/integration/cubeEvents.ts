import type { SmartCubeCubieState, SmartCubeEvent } from 'smartcube-web-bluetooth';

import * as GyroOrientation from '@wstein/regrip-core/domain/GyroOrientation';
import * as PlayerSync from '@wstein/regrip-core/domain/PlayerSync';
import * as CubeFacelets from '@wstein/regrip-core/domain/CubeFacelets';
import * as Quaternion from '@wstein/regrip-core/domain/Quaternion';
import { formatOfflineStats, formatSingmasterCycles } from './cubeInfo';
import type {
  CustomTriggerEvent,
  MoveGapEvent,
  SessionGyroEvent,
  ShakeTriggerEvent,
  SmartCubeSessionEvent,
  VirtualRegripEvent,
} from '@wstein/regrip-core/session/smartCubeSession';
import type { regripToken as RegripToken } from '@wstein/regrip-core/domain/CubeNotation';

export type ScrambleSolver = (facelets: string) => Promise<string>;
export type SolveDetector = (facelets: string) => boolean;
export const defaultSolveDetector: SolveDetector = CubeFacelets.isSolvedFacelets;

function cubieStateFromPattern(pattern: CubeFacelets.patternData): SmartCubeCubieState {
  const decoded = CubeFacelets.faceletsToKociembaState(CubeFacelets.patternDataToFacelets(pattern));
  if (decoded.TAG !== 'Ok') throw new Error(decoded._0);
  return decoded._0;
}

function patternFromFacelets(facelets: string): CubeFacelets.patternData | undefined {
  const decoded = CubeFacelets.decodeFacelets(facelets);
  return decoded.TAG === 'Ok' ? decoded._0 : undefined;
}

type CubeEventControllerOptions = {
  homeOrientation?: Quaternion.t;
  solveScramble: ScrambleSolver;
  /** Adapter-owned body-frame permutation reconciliation for the 3D player. */
  shouldReconcilePlayer?: (facelets: string) => Promise<boolean>;
  trackPlayerMove?: (move: string) => void;
  resetPlayerTracking?: () => void;
  invalidatePlayerTracking?: () => void;
  /** Translate a protocol-body move into the displayed solver frame. */
  projectMove?: (move: string) => string;
  /** Always records detected notation, including while the 3D player is untrusted. */
  recordMove?: (move: string, rawMove?: string) => void;
  /** Translate a detected body-frame regrip before applying it to the solver frame. */
  projectRegrip?: (token: RegripToken) => string;
  applyRegrip?: (token: RegripToken) => void;
  onRegrip?: (event: VirtualRegripEvent, solverToken: string) => void;
  onCustomTrigger?: (event: CustomTriggerEvent, solverMove: string) => void;
  onShake?: (event: ShakeTriggerEvent) => void;
  onMoveGap?: (event: MoveGapEvent) => void;
  /** Raw transport events suitable for capture before their UI effects are applied. */
  onProtocolEvent?: (event: NonGyroSmartCubeEvent) => void;
  addMove: (move: string) => void;
  setOrientation: (quaternion: { x: number; y: number; z: number; w: number }) => void;
  setPlayerAlgorithm: (algorithm: string) => void;
  setInfo: (id: string, value: string) => void;
  showInfo: (id: string) => void;
  onDisconnect: () => void;
  onSolved?: () => void;
  onGyro?: (sample: { event: SessionGyroEvent }) => void;
  onHardware?: (event: Extract<SmartCubeEvent, { type: 'HARDWARE' }>) => void;
  /** Canonical URFDLB body-frame state; virtual regrips never alter copy/export data. */
  onFacelets?: (source: { facelets: string; state?: SmartCubeCubieState }) => void;
  solveDetector?: SolveDetector;
  onUnknownEvent?: (event: unknown) => void;
};

type NonGyroSmartCubeEvent = Exclude<SmartCubeEvent, { type: 'GYRO' }>;

export function createCubeEventController(options: CubeEventControllerOptions) {
  let playerSyncState = PlayerSync.initial;
  let playerUntrusted = false;
  // Copy/export state is always normalized to the protocol's canonical URFDLB
  // frame, matching the body-frame 3D player and incoming FACELETS snapshots.
  let normalizedPattern: CubeFacelets.patternData | undefined;

  function applyPlayerEffects(effects: PlayerSync.effect[]): void {
    for (const effect of effects) {
      switch (effect.kind) {
        case 'setAlgorithm':
          options.setPlayerAlgorithm(effect.algorithm);
          break;
        case 'addMove':
          options.addMove(effect.move);
          break;
      }
    }
  }

  function reset(): void {
    const [nextState, effects] = PlayerSync.reset(playerSyncState);
    playerSyncState = nextState;
    playerUntrusted = false;
    normalizedPattern = undefined;
    options.resetPlayerTracking?.();
    applyPlayerEffects(effects);
  }

  function handleGyro(event: SessionGyroEvent): void {
    const { x, y, z, w } = event.quaternion;
    options.setOrientation(
      Quaternion.multiply(options.homeOrientation ?? GyroOrientation.home, event.stabilized),
    );
    options.onGyro?.({ event });
    options.setInfo(
      'quaternion',
      `x: ${x.toFixed(3)}, y: ${y.toFixed(3)}, z: ${z.toFixed(3)}, w: ${w.toFixed(3)}`,
    );
    if (event.velocity) {
      const { x: vx, y: vy, z: vz } = event.velocity;
      options.showInfo('velocity');
      options.setInfo('velocity', `x: ${vx}, y: ${vy}, z: ${vz}`);
    }
  }

  function handleMove(event: Extract<SmartCubeEvent, { type: 'MOVE' }>): void {
    const displayedMove = options.projectMove?.(event.move) ?? event.move;
    options.recordMove?.(displayedMove, event.move);
    const nextPattern = normalizedPattern && CubeFacelets.applyMove(normalizedPattern, event.move);
    if (nextPattern) {
      normalizedPattern = nextPattern;
      const state = cubieStateFromPattern(nextPattern);
      const facelets = CubeFacelets.patternDataToFacelets(nextPattern);
      options.showInfo('cubieState');
      options.setInfo('cubieState', formatSingmasterCycles(state));
      options.onFacelets?.({
        facelets,
        state,
      });
      if ((options.solveDetector ?? defaultSolveDetector)(facelets)) options.onSolved?.();
    }
    if (!playerUntrusted) {
      options.trackPlayerMove?.(event.move);
      const [nextState, effects] = PlayerSync.move(playerSyncState, event.move);
      playerSyncState = nextState;
      applyPlayerEffects(effects);
    }
    if (event.serial !== undefined) {
      options.showInfo('eventSerial');
      options.setInfo('eventSerial', String(event.serial));
    }
    if (event.goCubeCenterOrientation !== undefined) {
      options.showInfo('centerOrientation');
      options.setInfo('centerOrientation', String(event.goCubeCenterOrientation));
    }
  }

  async function handleFacelets(
    event: Extract<SmartCubeEvent, { type: 'FACELETS' }>,
  ): Promise<void> {
    if (event.serial !== undefined) {
      options.showInfo('eventSerial');
      options.setInfo('eventSerial', String(event.serial));
    }
    normalizedPattern = patternFromFacelets(event.facelets);
    const state = normalizedPattern ? cubieStateFromPattern(normalizedPattern) : event.state;
    if (state) {
      options.showInfo('cubieState');
      options.setInfo('cubieState', formatSingmasterCycles(state));
    }
    options.onFacelets?.({ facelets: event.facelets, state });
    const [nextState, syncGeneration] = PlayerSync.beginSnapshot(playerSyncState);
    playerSyncState = nextState;
    // This packet is authoritative. Moves following it are safe to buffer for
    // its async solve, even when a prior packet gap made the player untrusted.
    playerUntrusted = false;

    const solved = (options.solveDetector ?? defaultSolveDetector)(event.facelets);
    if (solved) options.onSolved?.();
    const needsReconcile = await (options.shouldReconcilePlayer?.(event.facelets) ?? true);
    if (!needsReconcile) {
      const [confirmedState, effects] = PlayerSync.confirm(playerSyncState, syncGeneration);
      playerSyncState = confirmedState;
      applyPlayerEffects(effects);
      return;
    }
    const algorithm = solved ? '' : await options.solveScramble(event.facelets);
    const [resolvedState, effects] = PlayerSync.resolve(playerSyncState, syncGeneration, algorithm);
    playerSyncState = resolvedState;
    applyPlayerEffects(effects);
  }

  function handleHardware(event: Extract<SmartCubeEvent, { type: 'HARDWARE' }>): void {
    if (event.hardwareName !== undefined) options.setInfo('hardwareName', event.hardwareName);
    if (event.hardwareVersion !== undefined)
      options.setInfo('hardwareVersion', event.hardwareVersion);
    if (event.softwareVersion !== undefined)
      options.setInfo('softwareVersion', event.softwareVersion);
    if (event.productDate !== undefined) options.setInfo('productDate', event.productDate);
    if (event.gyroSupported !== undefined)
      options.setInfo('gyroSupported', event.gyroSupported ? 'YES' : 'NO');
    if (event.goCubeType) {
      options.showInfo('goCubeType');
      options.setInfo('goCubeType', `${event.goCubeType.name} (${event.goCubeType.code})`);
    }
    if (event.goCubeOfflineStats) {
      const stats = formatOfflineStats(event.goCubeOfflineStats);
      ['offlineMoves', 'offlineDuration', 'offlineSolves'].forEach(options.showInfo);
      options.setInfo('offlineMoves', stats.moves);
      options.setInfo('offlineDuration', stats.duration);
      options.setInfo('offlineSolves', stats.solves);
    }
    options.onHardware?.(event);
  }

  function invalidatePlayerState(): void {
    playerUntrusted = true;
    normalizedPattern = undefined;
    playerSyncState = PlayerSync.invalidate(playerSyncState);
    options.invalidatePlayerTracking?.();
  }

  function handle(event: SmartCubeSessionEvent): void {
    switch (event.type) {
      case 'GYRO':
        handleGyro(event);
        break;
      case 'REGRIP': {
        // World gyro only detects the gesture. Integer Body→Solver frame
        // permutations, never quaternions, rename subsequent BLE moves.
        const solverToken = options.projectRegrip?.(event.notationToken) ?? event.notationToken;
        options.recordMove?.(solverToken);
        options.applyRegrip?.(event.notationToken);
        options.onRegrip?.(event, solverToken);
        break;
      }
      case 'CUSTOM_TRIGGER':
        options.onCustomTrigger?.(event, options.projectMove?.(event.move) ?? event.move);
        break;
      case 'SHAKE':
        options.onShake?.(event);
        break;
      case 'MOVE_GAP':
        invalidatePlayerState();
        options.onMoveGap?.(event);
        break;
      case 'MOVE':
        options.onProtocolEvent?.(event);
        handleMove(event);
        break;
      case 'FACELETS':
        options.onProtocolEvent?.(event);
        handleFacelets(event).catch((error) => console.error('facelets handler failed', error));
        break;
      case 'HARDWARE':
        options.onProtocolEvent?.(event);
        handleHardware(event);
        break;
      case 'BATTERY':
        options.onProtocolEvent?.(event);
        options.setInfo('batteryLevel', `${event.batteryLevel}%`);
        break;
      case 'DISCONNECT':
        options.onProtocolEvent?.(event);
        options.onDisconnect();
        break;
      default:
        options.onProtocolEvent?.(event as NonGyroSmartCubeEvent);
        options.onUnknownEvent?.(event);
        break;
    }
  }

  return { handle, invalidatePlayerState, reset };
}
