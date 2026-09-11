import type { SmartCubeCubieState, SmartCubeEvent } from 'smartcube-web-bluetooth';

import * as GyroOrientation from '@wstein/regrip-core/domain/GyroOrientation.res.mjs';
import * as PlayerSync from '@wstein/regrip-core/domain/PlayerSync.res.mjs';
import * as CubeFacelets from '@wstein/regrip-core/domain/CubeFacelets.res.mjs';
import * as Quaternion from '@wstein/regrip-core/domain/Quaternion.res.mjs';
import { formatOfflineStats, formatSingmasterCycles } from './cubeInfo';
import type { SessionGyroEvent } from '@wstein/regrip-core/session/smartCubeSession';
import type { TimerController } from './timerController';

export type ScrambleSolver = (facelets: string) => Promise<string>;
export type SolveDetector = (facelets: string) => boolean;
export const defaultSolveDetector: SolveDetector = CubeFacelets.isSolvedFacelets;

function cubieStateFromPattern(pattern: CubeFacelets.PatternData): SmartCubeCubieState {
  const decoded = CubeFacelets.faceletsToKociembaState(CubeFacelets.patternDataToFacelets(pattern));
  if (decoded.TAG !== 'Ok') throw new Error(decoded._0);
  return decoded._0;
}

function patternFromFacelets(facelets: string): CubeFacelets.PatternData | undefined {
  const decoded = CubeFacelets.decodeFacelets(facelets);
  return decoded.TAG === 'Ok' ? decoded._0 : undefined;
}

type CubeEventControllerOptions = {
  homeOrientation?: Quaternion.Quaternion;
  timer: TimerController;
  solveScramble: ScrambleSolver;
  /** Convert physical hardware facelets into the app's current virtual frame. */
  reframeFacelets?: (facelets: string) => string;
  /** Adapter-owned body-frame permutation reconciliation for the 3D player. */
  shouldReconcilePlayer?: (facelets: string) => Promise<boolean>;
  trackPlayerMove?: (move: string) => void;
  resetPlayerTracking?: () => void;
  invalidatePlayerTracking?: () => void;
  /** Translate a protocol-body move into the displayed solver frame. */
  projectMove?: (move: string) => string;
  /** Always records detected notation, including while the 3D player is untrusted. */
  recordMove?: (move: string) => void;
  addMove: (move: string) => void;
  setOrientation: (quaternion: { x: number; y: number; z: number; w: number }) => void;
  setPlayerAlgorithm: (algorithm: string) => void;
  setInfo: (id: string, value: string) => void;
  showInfo: (id: string) => void;
  onDisconnect: () => void;
  onSolved: () => void;
  onGyro?: (sample: { event: SessionGyroEvent }) => void;
  onHardware?: (event: Extract<SmartCubeEvent, { type: 'HARDWARE' }>) => void;
  /** The canonical solver-frame state available for copy/export controls. */
  onFacelets?: (source: { facelets: string; state?: SmartCubeCubieState }) => void;
  solveDetector?: SolveDetector;
  onUnknownEvent?: (event: unknown) => void;
};

type NonGyroSmartCubeEvent = Exclude<SmartCubeEvent, { type: 'GYRO' }>;

export function createCubeEventController(options: CubeEventControllerOptions) {
  let playerSyncState = PlayerSync.initial;
  let playerUntrusted = false;
  let displayedPattern: CubeFacelets.PatternData | undefined;

  function applyPlayerEffects(effects: PlayerSync.PlayerSyncEffect[]): void {
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
    displayedPattern = undefined;
    options.timer.reset();
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
    options.timer.onMove(event);
    const displayedMove = options.projectMove?.(event.move) ?? event.move;
    options.recordMove?.(displayedMove);
    const nextPattern = displayedPattern && CubeFacelets.applyMove(displayedPattern, displayedMove);
    if (nextPattern) {
      displayedPattern = nextPattern;
      const state = cubieStateFromPattern(nextPattern);
      options.showInfo('cubieState');
      options.setInfo('cubieState', formatSingmasterCycles(state));
      options.onFacelets?.({
        facelets: CubeFacelets.patternDataToFacelets(nextPattern),
        state,
      });
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
    const facelets = options.reframeFacelets?.(event.facelets) ?? event.facelets;
    // Reframe all exports together: body-local CP/CO/EP/EO cannot describe a
    // solver-frame facelet string after a virtual x/y/z regrip.
    displayedPattern = patternFromFacelets(facelets);
    const state = displayedPattern ? cubieStateFromPattern(displayedPattern) : event.state;
    if (state) {
      options.showInfo('cubieState');
      options.setInfo('cubieState', formatSingmasterCycles(state));
    }
    options.onFacelets?.({ facelets, state });
    const [nextState, syncGeneration] = PlayerSync.beginSnapshot(playerSyncState);
    playerSyncState = nextState;
    // This packet is authoritative. Moves following it are safe to buffer for
    // its async solve, even when a prior packet gap made the player untrusted.
    playerUntrusted = false;

    // TwistyPlayer is a body-frame renderer, so its setup snapshot must use
    // the raw protocol facelets just as its subsequent MOVE events do. The
    // reframed string above remains the canonical solver-facing export state.
    const solved = (options.solveDetector ?? defaultSolveDetector)(event.facelets);
    if (solved) options.onSolved();
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
    displayedPattern = undefined;
    playerSyncState = PlayerSync.invalidate(playerSyncState);
    options.invalidatePlayerTracking?.();
  }

  function handle(event: NonGyroSmartCubeEvent): void {
    switch (event.type) {
      case 'MOVE':
        handleMove(event);
        break;
      case 'FACELETS':
        handleFacelets(event).catch((error) => console.error('facelets handler failed', error));
        break;
      case 'HARDWARE':
        handleHardware(event);
        break;
      case 'BATTERY':
        options.setInfo('batteryLevel', `${event.batteryLevel}%`);
        break;
      case 'DISCONNECT':
        options.onDisconnect();
        break;
      default:
        options.onUnknownEvent?.(event);
        break;
    }
  }

  return { handle, handleGyro, invalidatePlayerState, reset };
}
