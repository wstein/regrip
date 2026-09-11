import './style.css';

import * as THREE from 'three';

import { createCubingScrambleSolver } from '../adapters/cubing/scrambleSolver';
import { createPatternReconciler } from '../adapters/cubing/patternReconciler';
import { twistyPlayer } from '../adapters/cubing/twistyPlayer';
import { createTwistyPlayerSync } from '../adapters/cubing/twistyPlayerSync';
import { startSceneRenderLoop, type SceneRenderer } from '../adapters/three/sceneView';
import type { OrientationIndicatorColors } from '../adapters/three/orientationIndicator';
import * as infoPanel from './infoPanel';
import { createCommandPanel } from './commandPanel';
import { createJsonlLog, downloadJsonl } from './jsonlLog';
import { createLiveLog } from './liveLog';
import { mountFullscreenToggle } from './fullscreen';
import { simplifyMoves } from './moveSimplifier';
import { createSessionSignals } from './sessionSignals';
import { createCubeEventController } from '../integration/cubeEvents';
import { connectCube } from '../integration/connection';
import { JSONL_REPLAY_FORMAT, JSONL_REPLAY_VERSION } from '@wstein/regrip-core/session/jsonlFormat';
import { createTimerController } from '../integration/timerController';
import { formatCapabilities } from '../integration/cubeInfo';
import {
  formatCubeExport,
  type CubeExportFormat,
  type CubeExportSource,
} from '../integration/cubeExport';
import { featurePresets } from '@wstein/regrip-core/session/features';
import { createSmartCubeSession } from '@wstein/regrip-core/session/smartCubeSession';
import { createSolverFrame } from '../adapters/three/solverFrame';

infoPanel.mountCube(twistyPlayer);
infoPanel.clearInfo();
mountFullscreenToggle();

// Resting pose shown before any gyro data; the cube settles to
// GyroOrientation.home once GYRO events start arriving.
const cubeQuaternion = new THREE.Quaternion().setFromEuler(
  new THREE.Euler((30 * Math.PI) / 180, (-30 * Math.PI) / 180, 0),
);
const restingViewQuaternion = cubeQuaternion.clone();
let sceneRenderer: SceneRenderer | undefined;
let orientationTracking = false;
const playerSync = createTwistyPlayerSync(twistyPlayer, () => sceneRenderer?.requestRender());
const playerPatterns = createPatternReconciler();
// Replaced with `undefined` by Vite in production, allowing Rollup to exclude
// the replay transport and panel from the published lab bundle.
const replay = import.meta.env.DEV ? window.__smartcubeReplay : undefined;
const session =
  replay?.session ?? createSmartCubeSession({ connect: connectCube, features: featurePresets.all });
if (replay) void import('./replayPanel').then(({ mountReplayPanel }) => mountReplayPanel(replay));
const sessionSignals = createSessionSignals(session);
const eventLog = createJsonlLog();
const commandPanel = createCommandPanel();
const liveLog = createLiveLog({
  onClear: () => eventLog.clear(),
  onFocusEntry: (entry) => {
    if (!replay) return;
    const timestamp = (entry.log.data as Record<string, unknown>).timestamp;
    if (typeof timestamp === 'number') void replay.seekToTimestamp(timestamp);
  },
  onReproduceMoves: (moves) => {
    const algorithm = moves.join(' ');
    playerSync.setAlgorithm(algorithm);
    infoPanel.setDetectedMoves(algorithm);
  },
});
eventLog.subscribe((entry) => {
  liveLog.appendLogEntry(entry);
});
// Raw decoder evidence intentionally bypasses the JSONL state capture and the
// session event stream. Live Trace keeps it in its own small debug buffer.
session.subscribeDiagnostics((diagnostic) => liveLog.appendDiagnostic(diagnostic));
const solverFrame = createSolverFrame();
let cubeExportSource: CubeExportSource | undefined;
const virtualFrameQuaternion = new THREE.Quaternion();
const virtualFrameColors: OrientationIndicatorColors = { x: 0xff3131, y: 0xffffff, z: 0x78ed3e };
const faceColors: Record<string, number> = {
  U: 0xffffff,
  R: 0xff3131,
  F: 0x78ed3e,
  D: 0xfff34a,
  L: 0xff8a2a,
  B: 0x3568ff,
};

function syncVirtualFrameOrientation(): void {
  const { right, up, front, faces } = solverFrame.orientation();
  virtualFrameQuaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...right),
      new THREE.Vector3(...up),
      new THREE.Vector3(...front),
    ),
  );
  virtualFrameColors.x = faceColors[faces.right]!;
  virtualFrameColors.y = faceColors[faces.up]!;
  virtualFrameColors.z = faceColors[faces.front]!;
  sceneRenderer?.requestRender();
}

function setOrientationTracking(tracking: boolean): void {
  orientationTracking = tracking;
  sceneRenderer?.setManualOrientationEnabled(!tracking);
  infoPanel.setOrientationTracking(tracking);
}

function resetViewOrientation(): void {
  cubeQuaternion.copy(restingViewQuaternion);
  sceneRenderer?.requestRender();
}

infoPanel.on('reset-state', 'click', async () => {
  if (!window.confirm("Reset the cube state? This clears the cube's stored state.")) return;
  const conn = session.getState().connection;
  if (!conn?.capabilities.reset) {
    infoPanel.showFeedback('This cube does not support resetting its stored state.');
    return;
  }
  try {
    await session.sendCommand({ type: 'REQUEST_RESET' });
    playerSync.setAlgorithm('');
    infoPanel.showFeedback('Cube state reset requested.');
  } catch (error) {
    infoPanel.showFeedback(
      `Could not reset cube state: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
});

infoPanel.on('reset-gyro', 'click', async () => {
  if (!orientationTracking) {
    resetViewOrientation();
    infoPanel.showFeedback('View orientation reset.');
    return;
  }
  if (!session.getState().connection?.capabilities.gyroscope) {
    infoPanel.showFeedback('This cube does not support a gyroscope.');
    return;
  }
  session.resetGyro();
  solverFrame.reset();
  syncVirtualFrameOrientation();
  infoPanel.showFeedback('Gyro and virtual move frame reset.');
});

infoPanel.on('track-orientation', 'click', () => {
  if (!session.getState().connection?.capabilities.gyroscope) return;
  const nextTracking = !orientationTracking;
  setOrientationTracking(nextTracking);
  if (nextTracking) {
    session.resetGyro();
    infoPanel.showFeedback('Gyro orientation tracking enabled.');
  } else {
    infoPanel.showFeedback('Gyro orientation tracking paused; drag the cube to set the view.');
  }
});

const timerController = createTimerController({
  isConnected: () => session.getState().status === 'connected',
  now: replay ? () => replay.virtualNowMs : undefined,
  setTimer: infoPanel.setTimer,
  showTimer: infoPanel.showTimer,
  setTimerColor: infoPanel.setTimerColor,
  setSkew: (value) => infoPanel.setInfo('skew', value),
});
replay?.subscribeRebuild(() => timerController.reset());
replay?.subscribeCursor(() => timerController.refresh());

const cubeEvents = createCubeEventController({
  timer: timerController,
  solveScramble: createCubingScrambleSolver(),
  shouldReconcilePlayer: (facelets) => playerPatterns.observeSnapshot(facelets),
  trackPlayerMove: (move) => playerPatterns.applyMove(move),
  resetPlayerTracking: () => playerPatterns.reset(),
  invalidatePlayerTracking: () => playerPatterns.reset(),
  projectMove: (move) => solverFrame.translate(move),
  addMove: (move) => {
    playerSync.addMove(move);
  },
  recordMove: (move) => {
    infoPanel.appendDetectedMove(move);
  },
  setOrientation: (quaternion) => {
    if (!orientationTracking) return;
    cubeQuaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    sceneRenderer?.requestRender();
  },
  setPlayerAlgorithm: (algorithm) => {
    playerSync.setAlgorithm(algorithm);
  },
  setInfo: infoPanel.setInfo,
  showInfo: infoPanel.showInfo,
  onSolved: () => {
    timerController.dispatch('solved');
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
  onFacelets: (source) => {
    cubeExportSource = source;
  },
  onUnknownEvent: (event) => {
    const type =
      event && typeof event === 'object' && 'type' in event && typeof event.type === 'string'
        ? event.type
        : 'unknown';
    infoPanel.showFeedback(`Unsupported cube event received: ${type}`);
  },
});

sessionSignals.event.subscribe((event) => {
  if (!event) return;
  if (event.type === 'GYRO') {
    cubeEvents.handleGyro(event);
    return;
  }
  if (event.type === 'REGRIP') {
    // World gyro only detects this event; Body→Solver integer permutations,
    // never quaternions, translate BLE URFDLB moves and facelets for the user.
    const solverToken = solverFrame.solverToken(event.notationToken);
    eventLog.record('virtual_regrip', { ...event, solverToken });
    infoPanel.appendDetectedMove(solverToken);
    solverFrame.applyRegrip(event.notationToken);
    syncVirtualFrameOrientation();
    return;
  }
  if (event.type === 'CUSTOM_TRIGGER') {
    const solverMove = solverFrame.translate(event.move);
    eventLog.record('custom_trigger', { ...event, solverMove });
    infoPanel.showFeedback(`Custom trigger detected: ${solverMove}`);
    return;
  }
  if (event.type === 'SHAKE') {
    eventLog.record('shake_trigger', { ...event });
    infoPanel.showFeedback(`Shake detected: ${event.steps} steps, ${event.reversals} reversals`);
    return;
  }
  if (event.type === 'MOVE_GAP') {
    eventLog.record('move_gap', event);
    if (session.getState().connection?.capabilities.facelets) {
      // The session sends REQUEST_FACELETS immediately after publishing this
      // gap. Record that recovery request before its snapshot can arrive.
      eventLog.record('cube_command', {
        name: 'Sync state',
        status: 'sent',
        reason: 'move_gap',
        error: null,
      });
    }
    cubeEvents.invalidatePlayerState();
    infoPanel.showFeedback(
      `Missed ${event.missing} move${event.missing === 1 ? '' : 's'}; syncing cube state.`,
    );
    return;
  }
  eventLog.record('cube_event', event);
  cubeEvents.handle(event);
});

let previousStatus = session.getState().status;
let appliedProfile = session.getState().profile;
sessionSignals.state.subscribe((state) => {
  if (state.profile !== appliedProfile) {
    appliedProfile = state.profile;
    eventLog.record('profile_selected', {
      id: state.profile.id,
      value: state.profile.value,
      sources: state.profile.sources,
    });
  }
  if (state.status === previousStatus) return;
  previousStatus = state.status;
  eventLog.record('session_status', { status: state.status, error: state.error });

  if (state.status === 'connecting') {
    sceneRenderer?.setActive(false);
    setOrientationTracking(false);
    cubeExportSource = undefined;
    solverFrame.reset();
    syncVirtualFrameOrientation();
    infoPanel.clearInfo();
    infoPanel.setOrientationTrackingAvailable(false);
    infoPanel.setResetOrientationEnabled(false);
    infoPanel.setTimerActivateEnabled(false);
    infoPanel.setConnectionStatus('Connecting…');
    return;
  }
  if (state.status === 'connected' && state.connection) {
    const connection = state.connection;
    if (!sceneRenderer) {
      sceneRenderer = startSceneRenderLoop(
        twistyPlayer,
        cubeQuaternion,
        virtualFrameQuaternion,
        virtualFrameColors,
        {
          onContextLost: () =>
            infoPanel.showFeedback(
              '3D preview paused after a GPU reset. Waiting for WebGL recovery…',
            ),
          onContextRestored: () => infoPanel.showFeedback('3D preview restored.'),
        },
      );
    } else sceneRenderer.setActive(true);
    infoPanel.setOrientationTrackingAvailable(connection.capabilities.gyroscope);
    setOrientationTracking(connection.capabilities.gyroscope);
    infoPanel.setInfo('deviceName', connection.deviceName);
    infoPanel.setInfo('deviceMAC', connection.deviceMAC || '- n/a -');
    infoPanel.setInfo('protocol', `${connection.protocol.name} (${connection.protocol.id})`);
    infoPanel.setInfo('capabilities', formatCapabilities(connection.capabilities));
    infoPanel.setResetOrientationEnabled(true);
    infoPanel.setTimerActivateEnabled(true);
    infoPanel.setConnectionStatus('Connected');
    infoPanel.setConnectLabel('Disconnect');
    commandPanel.render(connection.capabilities, {
      sendCommand: session.sendCommand,
      syncState: session.syncFacelets,
      sendVendorCommand: session.sendVendorCommand,
      onBeforeSend: (command) => {
        if ('type' in command && command.type === 'REQUEST_FACELETS') {
          // A user-requested Sync State is an explicit reconciliation point.
          // Do not let a stale local tracker suppress its authoritative player update.
          cubeEvents.invalidatePlayerState();
          playerPatterns.reset();
        }
      },
      onSend: (name) => {
        eventLog.record('cube_command', { name, status: 'sent', error: null });
      },
      onResult: (name, error) => {
        if (!error) return;
        eventLog.record('cube_command', {
          name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      },
    });
    return;
  }
  if (state.status === 'disconnected') {
    sceneRenderer?.setActive(false);
    setOrientationTracking(false);
    cubeExportSource = undefined;
    commandPanel.clear();
    solverFrame.reset();
    syncVirtualFrameOrientation();
    cubeEvents.reset();
    infoPanel.clearInfo();
    infoPanel.setOrientationTrackingAvailable(false);
    infoPanel.setResetOrientationEnabled(false);
    infoPanel.setTimerActivateEnabled(false);
    infoPanel.setConnectionStatus('Disconnected');
    infoPanel.setConnectLabel('Connect');
    return;
  }
  if (state.status === 'error') {
    sceneRenderer?.setActive(false);
    setOrientationTracking(false);
    cubeExportSource = undefined;
    commandPanel.clear();
    solverFrame.reset();
    syncVirtualFrameOrientation();
    cubeEvents.reset();
    infoPanel.clearInfo();
    infoPanel.setOrientationTrackingAvailable(false);
    infoPanel.setResetOrientationEnabled(false);
    infoPanel.setTimerActivateEnabled(false);
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

function currentJsonlLog(): string {
  const state = session.getState();
  return eventLog.toJsonl({
    format: JSONL_REPLAY_FORMAT,
    version: JSONL_REPLAY_VERSION,
    session: {
      status: state.status,
      device: state.connection?.deviceName ?? null,
      deviceMAC: state.connection?.deviceMAC ?? null,
      protocol: state.connection?.protocol ?? null,
      profile: state.profile.id,
      profileValue: state.profile.value,
    },
  });
}

infoPanel.on('download-log', 'click', () => {
  const contents = currentJsonlLog();
  const filename = `smartcube-log-${new Date().toISOString().replace(/:/g, '-')}.jsonl`;
  downloadJsonl(contents, filename);
  infoPanel.showFeedback('Trace downloaded.');
});

infoPanel.on('copy-log', 'click', () => {
  void infoPanel
    .copyText(currentJsonlLog())
    .then(() => infoPanel.showFeedback('Trace JSONL copied.'))
    .catch((error) => {
      console.error('unable to copy trace JSONL', error);
      infoPanel.showFeedback('Could not copy trace JSONL.');
    });
});

infoPanel.on('clear-detected-moves', 'click', () => {
  infoPanel.clearDetectedMoves();
});

infoPanel.on('simplify-detected-moves', 'click', () => {
  infoPanel.simplifyDetectedMoves(simplifyMoves);
  infoPanel.showFeedback('Detected moves simplified.');
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

const cubeExportButton = document.getElementById('copy-cube-state') as HTMLButtonElement;
const cubeExportMenu = document.getElementById('cube-export-menu') as HTMLElement;

infoPanel.on('copy-cube-state', 'click', () => {
  const open = cubeExportMenu.hidden;
  cubeExportMenu.hidden = !open;
  cubeExportButton.setAttribute('aria-expanded', String(open));
});

function copyCubeExport(format: CubeExportFormat, label: string): void {
  const value = formatCubeExport(cubeExportSource, format);
  cubeExportMenu.hidden = true;
  cubeExportButton.setAttribute('aria-expanded', 'false');
  if (!value) {
    infoPanel.showFeedback(`No valid cube state is available for ${label}.`);
    return;
  }
  void infoPanel
    .copyText(value)
    .then(() => infoPanel.showFeedback(`${label} copied.`))
    .catch((error) => {
      console.error(`unable to copy ${label}`, error);
      infoPanel.showFeedback(`Could not copy ${label}.`);
    });
}

infoPanel.on('copy-compact-facelets', 'click', () =>
  copyCubeExport('compact-facelets', 'Compact facelets'),
);
infoPanel.on('copy-spaced-facelets', 'click', () =>
  copyCubeExport('spaced-facelets', 'Spaced facelets'),
);
infoPanel.on('copy-singmaster-cycles', 'click', () =>
  copyCubeExport('singmaster-cycles', 'Singmaster cycles'),
);
infoPanel.on('copy-cubie-coordinates', 'click', () =>
  copyCubeExport('cubie-coordinates', 'CP / CO / EP / EO'),
);
infoPanel.on('copy-orbit64', 'click', () => copyCubeExport('orbit64', 'Orbit64 token'));

infoPanel.on('detectedMoves', 'input', () => infoPanel.syncDetectedMoveCount());

infoPanel.on('start-timer', 'click', () => {
  timerController.dispatch('activate');
});
