import type { SmartCubeEvent } from 'smartcube-web-bluetooth';

import * as GyroOrientation from '../domain/GyroOrientation.res.mjs';
import * as OrientationStabilizer from '../domain/OrientationStabilizer.res.mjs';
import * as Cube333 from '../domain/Cube333.res.mjs';
import { formatCubieState, formatOfflineStats } from './cubeInfo';
import type { TimerController } from './timerController';

export type ScrambleSolver = (facelets: string) => Promise<string>;
export type SolveDetector = (cube: Cube333.Cube333) => boolean;
export const defaultSolveDetector: SolveDetector = Cube333.isSolved;

type CubeEventControllerOptions = {
  gyro: GyroOrientation.GyroOrientation;
  stabilizer: OrientationStabilizer.OrientationStabilizer;
  timer: TimerController;
  solveScramble: ScrambleSolver;
  addMove: (move: string) => void;
  setOrientation: (quaternion: { x: number; y: number; z: number; w: number }) => void;
  setPlayerAlgorithm: (algorithm: string) => void;
  setInfo: (id: string, value: string) => void;
  showInfo: (id: string) => void;
  onDisconnect: () => void;
  onSolved: () => void;
  onHardware?: (event: Extract<SmartCubeEvent, { type: 'HARDWARE' }>) => void;
  solveDetector?: SolveDetector;
  onUnknownEvent?: (event: unknown) => void;
};

export function createCubeEventController(options: CubeEventControllerOptions) {
  let cubeStateInitialized = false;

  function reset(): void {
    cubeStateInitialized = false;
    GyroOrientation.resetBasis(options.gyro);
    OrientationStabilizer.reset(options.stabilizer);
    options.timer.reset();
    options.setPlayerAlgorithm('');
  }

  function handleGyro(event: Extract<SmartCubeEvent, { type: 'GYRO' }>): void {
    const { x, y, z, w } = event.quaternion;
    const relative = GyroOrientation.relative(options.gyro, event.quaternion);
    const velocity = event.velocity ? Math.hypot(event.velocity.x, event.velocity.y, event.velocity.z) : 0;
    const stabilized = OrientationStabilizer.update(options.stabilizer, relative, velocity);
    options.setOrientation(GyroOrientation.applyHome(options.gyro, stabilized));
    options.setInfo('quaternion', `x: ${x.toFixed(3)}, y: ${y.toFixed(3)}, z: ${z.toFixed(3)}, w: ${w.toFixed(3)}`);
    if (event.velocity) {
      const { x: vx, y: vy, z: vz } = event.velocity;
      options.showInfo('velocity');
      options.setInfo('velocity', `x: ${vx}, y: ${vy}, z: ${vz}`);
    }
  }

  function handleMove(event: Extract<SmartCubeEvent, { type: 'MOVE' }>): void {
    options.timer.onMove(event);
    options.addMove(event.move);
    if (event.serial !== undefined) {
      options.showInfo('eventSerial');
      options.setInfo('eventSerial', String(event.serial));
    }
    if (event.goCubeCenterOrientation !== undefined) {
      options.showInfo('centerOrientation');
      options.setInfo('centerOrientation', String(event.goCubeCenterOrientation));
    }
  }

  async function handleFacelets(event: Extract<SmartCubeEvent, { type: 'FACELETS' }>): Promise<void> {
    if (event.serial !== undefined) {
      options.showInfo('eventSerial');
      options.setInfo('eventSerial', String(event.serial));
    }
    if (event.state) {
      options.showInfo('cubieState');
      options.setInfo('cubieState', formatCubieState(event.state));
    }
    const cube = Cube333.fromFacelets(event.facelets);
    const solved = (options.solveDetector ?? defaultSolveDetector)(cube);
    if (solved) options.onSolved();
    if (cubeStateInitialized) return;

    cubeStateInitialized = true;
    options.setPlayerAlgorithm(solved ? '' : await options.solveScramble(event.facelets));
  }

  function handleHardware(event: Extract<SmartCubeEvent, { type: 'HARDWARE' }>): void {
    if (event.hardwareName !== undefined) options.setInfo('hardwareName', event.hardwareName);
    if (event.hardwareVersion !== undefined) options.setInfo('hardwareVersion', event.hardwareVersion);
    if (event.softwareVersion !== undefined) options.setInfo('softwareVersion', event.softwareVersion);
    if (event.productDate !== undefined) options.setInfo('productDate', event.productDate);
    if (event.gyroSupported !== undefined) options.setInfo('gyroSupported', event.gyroSupported ? 'YES' : 'NO');
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

  function handle(event: SmartCubeEvent): void {
    switch (event.type) {
      case 'GYRO': handleGyro(event); break;
      case 'MOVE': handleMove(event); break;
      case 'FACELETS': handleFacelets(event).catch(error => console.error('facelets handler failed', error)); break;
      case 'HARDWARE': handleHardware(event); break;
      case 'BATTERY': options.setInfo('batteryLevel', `${event.batteryLevel}%`); break;
      case 'DISCONNECT': options.onDisconnect(); break;
      default: options.onUnknownEvent?.(event); break;
    }
  }

  return { handle, reset };
}
