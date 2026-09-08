
import './style.css'

import * as THREE from 'three';

import { createCubingScrambleSolver } from '../adapters/cubing/scrambleSolver';
import { twistyPlayer } from '../adapters/cubing/twistyPlayer';
import { startSceneRenderLoop } from '../adapters/three/sceneView';
import * as GyroOrientation from '../domain/GyroOrientation.res.mjs';
import * as OrientationStabilizer from '../domain/OrientationStabilizer.res.mjs';
import * as infoPanel from './infoPanel';
import { createJsonlLog, downloadJsonl } from './jsonlLog';
import { createCubeEventController } from '../session/cubeEvents';
import { connectCube } from '../session/connection';
import { createTimerController } from '../session/timerController';
import { formatCapabilities } from '../session/cubeInfo';
import { createSmartCubeSession } from '../session/smartCubeSession';
import type { SmartCubeProfile } from '../session/profile/types';

infoPanel.mountCube(twistyPlayer);
infoPanel.clearInfo();

// Resting pose shown before any gyro data; the cube settles to
// GyroOrientation.home once GYRO events start arriving.
const cubeQuaternion = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(30 * Math.PI / 180, -30 * Math.PI / 180, 0)
);
const gyro = GyroOrientation.make();
const stabilizer = OrientationStabilizer.make();
const session = createSmartCubeSession({ connect: connectCube, virtualRegrips: true });
const eventLog = createJsonlLog();

let renderLoopStarted = false;

infoPanel.on('reset-state', 'click', async () => {
  const conn = session.getState().connection;
  if (conn?.capabilities.reset) {
    await conn.sendCommand({ type: "REQUEST_RESET" });
  }
  twistyPlayer.alg = '';
});

infoPanel.on('reset-gyro', 'click', async () => {
  GyroOrientation.resetBasis(gyro);
  OrientationStabilizer.reset(stabilizer);
  session.resetVirtualRegrips();
});

function applyProfile(profile: SmartCubeProfile): void {
  const config = profile.stabilizer;
  if (!config) return;
  OrientationStabilizer.setConfig(stabilizer, {
    radiusDeg: config.radiusDeg ?? OrientationStabilizer.defaults.radiusDeg,
    snapDeg: config.snapDeg ?? OrientationStabilizer.defaults.snapDeg,
    hysteresisDeg: config.hysteresisDeg ?? OrientationStabilizer.defaults.hysteresisDeg,
    velocityMax: config.velocityMax ?? OrientationStabilizer.defaults.velocityMax,
    driftDegPerSec: config.driftDegPerSec ?? OrientationStabilizer.defaults.driftDegPerSec,
  });
}

const timerController = createTimerController({
  isConnected: () => session.getState().status === 'connected',
  setTimer: infoPanel.setTimer,
  showTimer: infoPanel.showTimer,
  setTimerColor: infoPanel.setTimerColor,
  setSkew: value => infoPanel.setInfo('skew', value),
});

const cubeEvents = createCubeEventController({
  gyro,
  stabilizer,
  timer: timerController,
  solveScramble: createCubingScrambleSolver(),
  addMove: move => {
    twistyPlayer.experimentalAddMove(move, { cancel: false });
    infoPanel.appendDetectedMove(move);
  },
  setOrientation: quaternion => cubeQuaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w),
  setPlayerAlgorithm: algorithm => { twistyPlayer.alg = algorithm; },
  setInfo: infoPanel.setInfo,
  showInfo: infoPanel.showInfo,
  onSolved: () => {
    timerController.dispatch('solved');
    twistyPlayer.alg = '';
  },
  onDisconnect: () => {
    // The session owns teardown and publishes the resulting disconnected state.
  },
  onGyro: ({ event, velocity, dtSeconds, relative, stabilized }) => {
    eventLog.record('gyro_stabilizer', {
      timestamp: event.timestamp,
      quaternion: event.quaternion,
      velocity: event.velocity ?? null,
      velocityMagnitude: velocity,
      dtSeconds,
      relative,
      stabilized,
    });
  },
});

applyProfile(session.getState().profile.value);
session.subscribeEvents(event => {
  if (event.type === 'REGRIP') {
    // Virtual regrips are history/log events. BLE MOVE packets remain physical
    // URFDLB moves and are never remapped through gyro orientation.
    eventLog.record('virtual_regrip', event);
    infoPanel.appendDetectedMove(event.notationToken);
    return;
  }
  eventLog.record('cube_event', event as unknown as Record<string, unknown>);
  cubeEvents.handle(event);
});

let previousStatus = session.getState().status;
let appliedProfile = session.getState().profile;
session.subscribe(state => {
  if (state.profile !== appliedProfile) {
    appliedProfile = state.profile;
    applyProfile(state.profile.value);
    eventLog.record('profile_selected', {
      id: state.profile.id,
      value: state.profile.value as unknown as Record<string, unknown>,
      sources: state.profile.sources,
    });
  }
  if (state.status === previousStatus) return;
  previousStatus = state.status;
  eventLog.record('session_status', { status: state.status, error: state.error });

  if (state.status === 'connecting') {
    infoPanel.clearInfo();
    infoPanel.setConnectionStatus('Connecting…');
    return;
  }
  if (state.status === 'connected' && state.connection) {
    const connection = state.connection;
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
    return;
  }
  if (state.status === 'disconnected') {
    cubeEvents.reset();
    infoPanel.clearInfo();
    infoPanel.setConnectionStatus('Disconnected');
    infoPanel.setConnectLabel('Connect');
    return;
  }
  if (state.status === 'error') {
    cubeEvents.reset();
    infoPanel.clearInfo();
    infoPanel.setConnectionStatus(`Failed: ${state.error}`);
    infoPanel.setConnectLabel('Connect');
    alert(`Unable to connect to smart cube: ${state.error}`);
  }
});

infoPanel.on('connect', 'click', async () => {
  const state = session.getState();
  if (state.status === 'connecting') return;
  if (state.connection) await session.disconnect();
  else await session.connect();
});

infoPanel.on('start-log', 'click', () => {
  const state = session.getState();
  eventLog.start({
    session: {
      status: state.status,
      profile: state.profile.id,
      profileValue: state.profile.value,
    },
  });
  infoPanel.setLogRecording(true);
});

infoPanel.on('stop-log', 'click', () => {
  if (!eventLog.active) return;
  const filename = `smartcube-log-${new Date().toISOString().replace(/:/g, '-')}.jsonl`;
  downloadJsonl(eventLog.stop(), filename);
  infoPanel.setLogRecording(false);
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
