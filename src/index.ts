
import './style.css'

import type { Subscription } from 'rxjs';
import * as THREE from 'three';
import type { SmartCubeConnection } from 'smartcube-web-bluetooth';

import { patternToFacelets } from './utils';
import * as GyroOrientation from './GyroOrientation.res.mjs';
import * as infoPanel from './infoPanel';
import { createCubeEventController } from './cubeEvents';
import { twistyPlayer } from './twistyPlayer';
import { startSceneRenderLoop } from './sceneView';
import { connectCube, disconnectConnection, requestInitialState } from './connection';
import { createTimerController } from './timerController';
import { formatCapabilities } from './cubeInfo';

const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

infoPanel.mountCube(twistyPlayer);

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

async function disconnectCube() {
  eventsSub?.unsubscribe();
  eventsSub = null;
  const c = conn;
  conn = null;
  await disconnectConnection(c);
  cubeEvents.reset();
  infoPanel.clearInfo();
  infoPanel.setConnectionStatus('Disconnected');
  infoPanel.setConnectLabel('Connect');
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
  cubeQuaternion,
  gyro,
  player: twistyPlayer,
  timer: timerController,
  onDisconnect: () => {
    eventsSub?.unsubscribe();
    eventsSub = null;
    conn = null;
    infoPanel.clearInfo();
    infoPanel.setConnectionStatus('Disconnected');
    infoPanel.setConnectLabel('Connect');
  },
});

twistyPlayer.experimentalModel.currentPattern.addFreshListener(async (kpattern) => {
  const facelets = patternToFacelets(kpattern);
  if (facelets == SOLVED_STATE) {
    timerController.dispatch("solved");
    twistyPlayer.alg = '';
  }
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
