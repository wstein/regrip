
import './style.css'

import type { Subscription } from 'rxjs';
import * as THREE from 'three';
import type { SmartCubeConnection } from 'smartcube-web-bluetooth';

import { createCubingScrambleSolver } from '../adapters/cubing/scrambleSolver';
import { twistyPlayer } from '../adapters/cubing/twistyPlayer';
import { startSceneRenderLoop } from '../adapters/three/sceneView';
import * as GyroOrientation from '../domain/GyroOrientation.res.mjs';
import * as infoPanel from './infoPanel';
import { createCubeEventController } from '../session/cubeEvents';
import { connectCube, disconnectConnection, requestInitialState } from '../session/connection';
import { createTimerController } from '../session/timerController';
import { formatCapabilities } from '../session/cubeInfo';

infoPanel.mountCube(twistyPlayer);
infoPanel.clearInfo();

let conn: SmartCubeConnection | null = null;
let eventsSub: Subscription | null = null;

// Resting pose shown before any gyro data; the cube settles to
// GyroOrientation.home once GYRO events start arriving.
const cubeQuaternion = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(30 * Math.PI / 180, -30 * Math.PI / 180, 0)
);
const gyro = GyroOrientation.make();

let renderLoopStarted = false;

infoPanel.on('reset-state', 'click', async () => {
  if (conn?.capabilities.reset) {
    await conn.sendCommand({ type: "REQUEST_RESET" });
  }
  twistyPlayer.alg = '';
});

infoPanel.on('reset-gyro', 'click', async () => {
  GyroOrientation.resetBasis(gyro);
});

function finishDisconnect(): void {
  conn = null;
  cubeEvents.reset();
  infoPanel.clearInfo();
  infoPanel.setConnectionStatus('Disconnected');
  infoPanel.setConnectLabel('Connect');
}

async function disconnectCube() {
  eventsSub?.unsubscribe();
  eventsSub = null;
  const c = conn;
  conn = null;
  await disconnectConnection(c);
  finishDisconnect();
}

infoPanel.on('connect', 'click', async () => {
  if (conn) {
    await disconnectCube();
    return;
  }
  let connection: SmartCubeConnection | undefined;
  try {
    infoPanel.clearInfo();
    infoPanel.setConnectionStatus('Connecting…');
    connection = await connectCube();
    eventsSub = connection.events$.subscribe(cubeEvents.handle);
    await requestInitialState(connection);
    // Only now is the connection fully usable.
    conn = connection;
    if (!renderLoopStarted) {
      renderLoopStarted = true;
      startSceneRenderLoop(twistyPlayer, cubeQuaternion);
    }
    infoPanel.setInfo('deviceName', connection.deviceName);
    infoPanel.setInfo('deviceMAC', connection.deviceMAC || '- n/a -');
    infoPanel.setInfo('protocol', `${connection.protocol.name} (${connection.protocol.id})`);
    infoPanel.setInfo('capabilities', formatCapabilities(connection.capabilities));
    infoPanel.setConnectionStatus('Connected');
    infoPanel.setConnectLabel('Disconnect');
  } catch (error) {
    eventsSub?.unsubscribe();
    eventsSub = null;
    await disconnectConnection(connection ?? null);
    conn = null;
    console.error('Unable to connect to smart cube', error);
    const message = error instanceof Error ? error.message : String(error);
    infoPanel.setConnectionStatus(`Failed: ${message}`);
    infoPanel.setConnectLabel('Connect');
    alert(`Unable to connect to smart cube: ${message}`);
  }
});

const timerController = createTimerController({
  isConnected: () => conn !== null,
  setTimer: infoPanel.setTimer,
  showTimer: infoPanel.showTimer,
  setTimerColor: infoPanel.setTimerColor,
  setSkew: value => infoPanel.setInfo('skew', value),
});

const cubeEvents = createCubeEventController({
  gyro,
  timer: timerController,
  solveScramble: createCubingScrambleSolver(),
  addMove: move => twistyPlayer.experimentalAddMove(move, { cancel: false }),
  setOrientation: quaternion => cubeQuaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w),
  setPlayerAlgorithm: algorithm => { twistyPlayer.alg = algorithm; },
  setInfo: infoPanel.setInfo,
  showInfo: infoPanel.showInfo,
  onSolved: () => {
    timerController.dispatch('solved');
    twistyPlayer.alg = '';
  },
  onDisconnect: () => {
    eventsSub?.unsubscribe();
    eventsSub = null;
    finishDisconnect();
  },
});

document.addEventListener('keydown', (event) => {
  if (event.key === ' ') {
    event.preventDefault();
    timerController.dispatch("activate");
  }
});

infoPanel.on('cube', 'touchstart', () => {
  timerController.dispatch("activate");
});
