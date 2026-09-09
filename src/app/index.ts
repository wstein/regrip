import './style.css';

import * as THREE from 'three';

import { createCubingScrambleSolver } from '../adapters/cubing/scrambleSolver';
import { twistyPlayer } from '../adapters/cubing/twistyPlayer';
import { startSceneRenderLoop } from '../adapters/three/sceneView';
import type { OrientationIndicatorColors } from '../adapters/three/orientationIndicator';
import * as infoPanel from './infoPanel';
import { createCommandPanel } from './commandPanel';
import { createJsonlLog, downloadJsonl } from './jsonlLog';
import { createLiveLog } from './liveLog';
import { createCubeEventController } from '../session/cubeEvents';
import { connectCube } from '../session/connection';
import { JSONL_REPLAY_FORMAT, JSONL_REPLAY_VERSION } from '../session/jsonlFormat';
import { createTimerController } from '../session/timerController';
import { formatCapabilities } from '../session/cubeInfo';
import { createSmartCubeSession } from '../session/smartCubeSession';
import { createVirtualMoveFrame } from '../session/virtualMoveFrame';

infoPanel.mountCube(twistyPlayer);
infoPanel.clearInfo();

// Resting pose shown before any gyro data; the cube settles to
// GyroOrientation.home once GYRO events start arriving.
const cubeQuaternion = new THREE.Quaternion().setFromEuler(
  new THREE.Euler((30 * Math.PI) / 180, (-30 * Math.PI) / 180, 0),
);
const session = createSmartCubeSession({ connect: connectCube, virtualRegrips: true });
const eventLog = createJsonlLog();
const commandPanel = createCommandPanel();
const liveLog = createLiveLog({
  onReproduceMoves: (moves) => {
    const algorithm = moves.join(' ');
    twistyPlayer.alg = algorithm;
    infoPanel.setDetectedMoves(algorithm);
  },
});
eventLog.subscribe((entry, recordingCount) => {
  liveLog.appendLogEntry(entry);
  infoPanel.setLogRecording(eventLog.active, recordingCount);
});
const virtualMoveFrame = createVirtualMoveFrame();
const virtualFrameQuaternion = new THREE.Quaternion();
const virtualFrameColors: OrientationIndicatorColors = { r: 0xff3131, u: 0xffffff, f: 0x78ed3e };
const faceColors: Record<string, number> = {
  U: 0xffffff,
  R: 0xff3131,
  F: 0x78ed3e,
  D: 0xfff34a,
  L: 0xff8a2a,
  B: 0x3568ff,
};

function syncVirtualFrameOrientation(): void {
  const { right, up, front, faces } = virtualMoveFrame.orientation();
  virtualFrameQuaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...right),
      new THREE.Vector3(...up),
      new THREE.Vector3(...front),
    ),
  );
  virtualFrameColors.r = faceColors[faces.right]!;
  virtualFrameColors.u = faceColors[faces.up]!;
  virtualFrameColors.f = faceColors[faces.front]!;
}

let renderLoopStarted = false;

infoPanel.on('reset-state', 'click', async () => {
  if (!window.confirm("Reset the cube state? This clears the cube's stored state.")) return;
  const conn = session.getState().connection;
  if (!conn?.capabilities.reset) {
    infoPanel.showFeedback('This cube does not support resetting its stored state.');
    return;
  }
  try {
    await session.sendCommand({ type: 'REQUEST_RESET' });
    twistyPlayer.alg = '';
    infoPanel.showFeedback('Cube state reset requested.');
  } catch (error) {
    infoPanel.showFeedback(
      `Could not reset cube state: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
});

infoPanel.on('reset-gyro', 'click', async () => {
  session.resetGyro();
  virtualMoveFrame.reset();
  syncVirtualFrameOrientation();
  infoPanel.showFeedback('Gyro and virtual move frame reset.');
});

const timerController = createTimerController({
  isConnected: () => session.getState().status === 'connected',
  setTimer: infoPanel.setTimer,
  showTimer: infoPanel.showTimer,
  setTimerColor: infoPanel.setTimerColor,
  setSkew: (value) => infoPanel.setInfo('skew', value),
});

const cubeEvents = createCubeEventController({
  timer: timerController,
  solveScramble: createCubingScrambleSolver(),
  reframeFacelets: (facelets) => virtualMoveFrame.reframeFacelets(facelets),
  addMove: (move) => {
    twistyPlayer.experimentalAddMove(move, { cancel: false });
    infoPanel.appendDetectedMove(virtualMoveFrame.translate(move));
  },
  setOrientation: (quaternion) =>
    cubeQuaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w),
  setPlayerAlgorithm: (algorithm) => {
    twistyPlayer.alg = algorithm;
  },
  setInfo: infoPanel.setInfo,
  showInfo: infoPanel.showInfo,
  onSolved: () => {
    timerController.dispatch('solved');
    twistyPlayer.alg = '';
  },
  onDisconnect: () => {
    // The session owns teardown and publishes the resulting disconnected state.
  },
  onGyro: ({ event }) => {
    eventLog.record('gyro_stabilizer', {
      timestamp: event.timestamp,
      quaternion: event.quaternion,
      velocity: event.velocity ?? null,
      velocityMagnitude: event.velocityMagnitude,
      dtSeconds: event.dtSeconds,
      relative: event.relative,
      stabilized: event.stabilized,
    });
  },
});

session.subscribeEvents((event) => {
  if (event.type === 'GYRO') {
    cubeEvents.handleGyro(event);
    return;
  }
  if (event.type === 'REGRIP') {
    // Virtual regrips are history/log events. BLE MOVE packets remain physical
    // URFDLB moves and are never remapped through gyro orientation.
    eventLog.record('virtual_regrip', event);
    infoPanel.appendDetectedMove(event.notationToken);
    virtualMoveFrame.applyRegrip(event.notationToken);
    syncVirtualFrameOrientation();
    return;
  }
  if (event.type === 'CUSTOM_TRIGGER') {
    eventLog.record('custom_trigger', event);
    infoPanel.showFeedback(`Custom trigger detected: ${event.move}`);
    return;
  }
  eventLog.record('cube_event', event as unknown as Record<string, unknown>);
  cubeEvents.handle(event);
});

let previousStatus = session.getState().status;
let appliedProfile = session.getState().profile;
session.subscribe((state) => {
  if (state.profile !== appliedProfile) {
    appliedProfile = state.profile;
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
    virtualMoveFrame.reset();
    syncVirtualFrameOrientation();
    infoPanel.clearInfo();
    infoPanel.setConnectionStatus('Connecting…');
    return;
  }
  if (state.status === 'connected' && state.connection) {
    const connection = state.connection;
    if (!renderLoopStarted) {
      renderLoopStarted = true;
      startSceneRenderLoop(
        twistyPlayer,
        cubeQuaternion,
        virtualFrameQuaternion,
        virtualFrameColors,
      );
    }
    infoPanel.setInfo('deviceName', connection.deviceName);
    infoPanel.setInfo('deviceMAC', connection.deviceMAC || '- n/a -');
    infoPanel.setInfo('protocol', `${connection.protocol.name} (${connection.protocol.id})`);
    infoPanel.setInfo('capabilities', formatCapabilities(connection.capabilities));
    infoPanel.setConnectionStatus('Connected');
    infoPanel.setConnectLabel('Disconnect');
    commandPanel.render(connection.capabilities, {
      sendCommand: session.sendCommand,
      sendVendorCommand: session.sendVendorCommand,
      onResult: (name, error) => {
        eventLog.record('cube_command', {
          name,
          status: error ? 'failed' : 'sent',
          error: error instanceof Error ? error.message : error ? String(error) : null,
        });
      },
    });
    return;
  }
  if (state.status === 'disconnected') {
    commandPanel.clear();
    virtualMoveFrame.reset();
    syncVirtualFrameOrientation();
    cubeEvents.reset();
    infoPanel.clearInfo();
    infoPanel.setConnectionStatus('Disconnected');
    infoPanel.setConnectLabel('Connect');
    return;
  }
  if (state.status === 'error') {
    commandPanel.clear();
    virtualMoveFrame.reset();
    syncVirtualFrameOrientation();
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
    format: JSONL_REPLAY_FORMAT,
    version: JSONL_REPLAY_VERSION,
    session: {
      status: state.status,
      profile: state.profile.id,
      profileValue: state.profile.value,
    },
  });
  infoPanel.setLogRecording(true, eventLog.recordingCount);
  infoPanel.showFeedback('Session recording started.');
});

infoPanel.on('stop-log', 'click', () => {
  if (!eventLog.active) return;
  const filename = `smartcube-log-${new Date().toISOString().replace(/:/g, '-')}.jsonl`;
  downloadJsonl(eventLog.stop(), filename);
  infoPanel.setLogRecording(false, eventLog.recordingCount);
  infoPanel.showFeedback('Recording downloaded.');
});

infoPanel.on('clear-detected-moves', 'click', () => {
  infoPanel.clearDetectedMoves();
});

infoPanel.on('copy-detected-moves', 'click', () => {
  void infoPanel
    .copyDetectedMoves()
    .then(() => infoPanel.showFeedback('Detected moves copied.'))
    .catch((error) => {
      console.error('unable to copy detected moves', error);
      infoPanel.showFeedback('Could not copy detected moves.');
    });
});

infoPanel.on('detectedMoves', 'input', () => infoPanel.syncDetectedMoveCount());

document.addEventListener('keydown', (event) => {
  if (event.key === ' ') {
    event.preventDefault();
    timerController.dispatch('activate');
  }
});

infoPanel.on('cube', 'touchstart', () => {
  timerController.dispatch('activate');
});
