import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';
import type { TwistyPlayer } from 'cubing/twisty';
import * as THREE from 'three';
import type { SmartCubeEvent } from 'smartcube-web-bluetooth';

import { formatCubieState, formatOfflineStats } from './cubeInfo';
import * as GyroOrientation from './GyroOrientation.res.mjs';
import * as infoPanel from './infoPanel';
import type { TimerController } from './timerController';
import { faceletsToPattern, kpuzzleReady } from './utils';
import { SOLVED_STATE } from './constants';

type CubeEventControllerOptions = {
  cubeQuaternion: THREE.Quaternion;
  gyro: GyroOrientation.GyroOrientation;
  player: TwistyPlayer;
  timer: TimerController;
  onDisconnect: () => void;
};

export function createCubeEventController(options: CubeEventControllerOptions) {
  let cubeStateInitialized = false;

  function reset(): void {
    cubeStateInitialized = false;
    GyroOrientation.resetBasis(options.gyro);
    options.timer.reset();
    options.player.alg = '';
  }

  function handleGyro(event: Extract<SmartCubeEvent, { type: 'GYRO' }>): void {
    const { x, y, z, w } = event.quaternion;
    const target = GyroOrientation.update(options.gyro, event.quaternion);
    options.cubeQuaternion.set(target.x, target.y, target.z, target.w);
    infoPanel.setInfo('quaternion', `x: ${x.toFixed(3)}, y: ${y.toFixed(3)}, z: ${z.toFixed(3)}, w: ${w.toFixed(3)}`);
    if (event.velocity) {
      const { x: vx, y: vy, z: vz } = event.velocity;
      infoPanel.showInfo('velocity');
      infoPanel.setInfo('velocity', `x: ${vx}, y: ${vy}, z: ${vz}`);
    }
  }

  function handleMove(event: Extract<SmartCubeEvent, { type: 'MOVE' }>): void {
    options.timer.onMove(event);
    options.player.experimentalAddMove(event.move, { cancel: false });
    if (event.serial !== undefined) {
      infoPanel.showInfo('eventSerial');
      infoPanel.setInfo('eventSerial', String(event.serial));
    }
    if (event.goCubeCenterOrientation !== undefined) {
      infoPanel.showInfo('centerOrientation');
      infoPanel.setInfo('centerOrientation', String(event.goCubeCenterOrientation));
    }
  }

  async function handleFacelets(event: Extract<SmartCubeEvent, { type: 'FACELETS' }>): Promise<void> {
    if (event.serial !== undefined) {
      infoPanel.showInfo('eventSerial');
      infoPanel.setInfo('eventSerial', String(event.serial));
    }
    if (event.state) {
      infoPanel.showInfo('cubieState');
      infoPanel.setInfo('cubieState', formatCubieState(event.state));
    }
    if (cubeStateInitialized) return;

    cubeStateInitialized = true;
    if (event.facelets === SOLVED_STATE) {
      options.player.alg = '';
    } else {
      await kpuzzleReady;
      const solution = await experimentalSolve3x3x3IgnoringCenters(faceletsToPattern(event.facelets));
      options.player.alg = solution.invert();
    }
    console.log('Initial cube state is applied successfully', event.facelets);
  }

  function handleHardware(event: Extract<SmartCubeEvent, { type: 'HARDWARE' }>): void {
    if (event.hardwareName !== undefined) infoPanel.setInfo('hardwareName', event.hardwareName);
    if (event.hardwareVersion !== undefined) infoPanel.setInfo('hardwareVersion', event.hardwareVersion);
    if (event.softwareVersion !== undefined) infoPanel.setInfo('softwareVersion', event.softwareVersion);
    if (event.productDate !== undefined) infoPanel.setInfo('productDate', event.productDate);
    if (event.gyroSupported !== undefined) infoPanel.setInfo('gyroSupported', event.gyroSupported ? 'YES' : 'NO');
    if (event.goCubeType) {
      infoPanel.showInfo('goCubeType');
      infoPanel.setInfo('goCubeType', `${event.goCubeType.name} (${event.goCubeType.code})`);
    }
    if (event.goCubeOfflineStats) {
      const stats = formatOfflineStats(event.goCubeOfflineStats);
      infoPanel.showInfo('offlineMoves');
      infoPanel.showInfo('offlineDuration');
      infoPanel.showInfo('offlineSolves');
      infoPanel.setInfo('offlineMoves', stats.moves);
      infoPanel.setInfo('offlineDuration', stats.duration);
      infoPanel.setInfo('offlineSolves', stats.solves);
    }
  }

  function handle(event: SmartCubeEvent): void {
    if (event.type !== 'GYRO') console.log('SmartCubeEvent', event);
    switch (event.type) {
      case 'GYRO': handleGyro(event); break;
      case 'MOVE': handleMove(event); break;
      case 'FACELETS': handleFacelets(event).catch(error => console.error('facelets handler failed', error)); break;
      case 'HARDWARE': handleHardware(event); break;
      case 'BATTERY': infoPanel.setInfo('batteryLevel', `${event.batteryLevel}%`); break;
      case 'DISCONNECT': options.onDisconnect(); break;
      default: assertNever(event);
    }
  }

  return { handle, reset };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled smart cube event: ${JSON.stringify(value)}`);
}
