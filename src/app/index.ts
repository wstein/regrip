import './style.css';

import { createCubingScrambleSolver } from '../adapters/cubing/scrambleSolver';
import { createPatternReconciler } from '../adapters/cubing/patternReconciler';
import { twistyPlayer } from '../adapters/cubing/twistyPlayer';
import { createTwistyPlayerSync } from '../adapters/cubing/twistyPlayerSync';
import { startSceneRenderLoop, type SceneRenderer } from '../adapters/three/sceneView';
import * as infoPanel from './infoPanel';
import { createCommandPanel } from './commandPanel';
import { createJsonlLog, downloadJsonl } from './jsonlLog';
import { createLiveLog } from './liveLog';
import { mountFullscreenToggle } from './fullscreen';
import { createDetectedMovesController } from './detectedMovesController';
import { createSessionSignals } from './sessionSignals';
import { createCubeEventController } from '../integration/cubeEvents';
import { connectCube } from '../integration/connection';
import { JSONL_REPLAY_FORMAT, JSONL_REPLAY_VERSION } from '@wstein/regrip-core/session/jsonlFormat';
import { createTimingDiagnostics } from '../integration/timingDiagnostics';
import { createSessionElapsedClock } from '../integration/sessionElapsed';
import { createSolveAnalysis } from '../integration/solveAnalysis';
import { formatCapabilities } from '../integration/cubeInfo';
import {
  formatCubeExport,
  type CubeExportFormat,
  type CubeExportSource,
} from '../integration/cubeExport';
import { featurePresets } from '@wstein/regrip-core/session/features';
import { createSmartCubeSession } from '@wstein/regrip-core/session/smartCubeSession';
import { createSolverFrame } from '../adapters/three/solverFrame';
import { sourceRevision } from './sourceRevision';
import { loadReplayFromUrl, mountMockDevicePicker } from './mockDevice';
import { createDropdownMenu } from './dom';

const sourceRevisionLink = document.getElementById('source-revision');
if (sourceRevisionLink instanceof HTMLAnchorElement) {
  const revision = sourceRevision(__REGRIP_BUILD_SHA__);
  sourceRevisionLink.href = revision.href;
  sourceRevisionLink.textContent = revision.label;
}

const detectedMoves = createDetectedMovesController({
  read: infoPanel.getDetectedMoves,
  write: infoPanel.setDetectedMoves,
  setCount: infoPanel.setDetectedMoveCount,
  setReadOnly: (readOnly) => {
    const editor = document.getElementById('detectedMoves');
    if (editor instanceof HTMLTextAreaElement) editor.readOnly = readOnly;
  },
  setSimplifyEnabled: (enabled) => {
    const simplify = document.getElementById('simplify-detected-moves');
    if (simplify instanceof HTMLButtonElement) simplify.disabled = !enabled;
  },
  setNotation: (notation) => {
    (['wca', 'sign', 'sse', 'raw-qtm'] as const).forEach((candidate) => {
      document
        .getElementById(`detected-notation-${candidate}`)
        ?.setAttribute('aria-pressed', String(candidate === notation));
    });
  },
});

infoPanel.mountCube(twistyPlayer);
infoPanel.clearInfo();
detectedMoves.clear();
mountFullscreenToggle();

let sceneRenderer: SceneRenderer | undefined;
let orientationTracking = false;
const playerSync = createTwistyPlayerSync(twistyPlayer, () => sceneRenderer?.requestRender());
const playerPatterns = createPatternReconciler();
const preseededReplay = import.meta.env.DEV ? window.__smartcubeReplay : undefined;
const mockReplayLoad = preseededReplay
  ? ({ requested: false } as const)
  : await loadReplayFromUrl();
const replay = preseededReplay ?? (mockReplayLoad.requested ? mockReplayLoad.replay : undefined);
const session =
  replay?.session ?? createSmartCubeSession({ connect: connectCube, features: featurePresets.all });
if (replay) void import('./replayPanel').then(({ mountReplayPanel }) => mountReplayPanel(replay));
mountMockDevicePicker({ load: mockReplayLoad });
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
    detectedMoves.replace(algorithm, moves);
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
const faceColors: Record<string, number> = {
  U: 0xffffff,
  R: 0xff3131,
  F: 0x78ed3e,
  D: 0xfff34a,
  L: 0xff8a2a,
  B: 0x3568ff,
};

function formatGripDescription(faces: { front: string; up: string; right: string }): string {
  const isHome = faces.front === 'F' && faces.up === 'U' && faces.right === 'R';
  return isHome ? 'Home' : `F:${faces.front} U:${faces.up} R:${faces.right}`;
}

function syncVirtualFrameOrientation(gesture?: string): void {
  const { right, up, front, faces } = solverFrame.orientation();
  sceneRenderer?.setVirtualFrameOrientation({
    right,
    up,
    front,
    colors: {
      x: faceColors[faces.right]!,
      y: faceColors[faces.up]!,
      z: faceColors[faces.front]!,
    },
  });
  infoPanel.setActiveGrip(formatGripDescription(faces), gesture);
}

function setOrientationTracking(tracking: boolean): void {
  orientationTracking = tracking;
  sceneRenderer?.setManualOrientationEnabled(!tracking);
  infoPanel.setOrientationTracking(tracking);
}

function resetViewOrientation(): void {
  sceneRenderer?.resetCubeOrientation();
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

const timingDiagnostics = createTimingDiagnostics({
  setSkew: (value) => infoPanel.setInfo('skew', value),
});
const elapsedClock = createSessionElapsedClock({
  now: () => performance.now(),
  setElapsed: infoPanel.setSessionElapsed,
});
const solveAnalysis = createSolveAnalysis(infoPanel.renderSolveAnalysis);
const replayStartedAt = replay?.items[0]?.timestamp ?? 0;
const refreshReplayElapsed = (): void => {
  if (!replay) return;
  const currentTimestamp = replay.items[Math.max(0, replay.position - 1)]?.timestamp;
  elapsedClock.setReplayElapsed(
    currentTimestamp === undefined ? 0 : currentTimestamp - replayStartedAt,
  );
};
replay?.subscribeRebuild(() => {
  timingDiagnostics.reset();
  solveAnalysis.reset();
  elapsedClock.reset();
});
replay?.subscribeCursor(refreshReplayElapsed);

const cubeEvents = createCubeEventController({
  solveScramble: createCubingScrambleSolver(),
  shouldReconcilePlayer: (facelets) => playerPatterns.observeSnapshot(facelets),
  trackPlayerMove: (move) => playerPatterns.applyMove(move),
  resetPlayerTracking: () => playerPatterns.reset(),
  invalidatePlayerTracking: () => playerPatterns.reset(),
  projectMove: (move) => solverFrame.translate(move),
  projectRegrip: (token) => solverFrame.solverToken(token),
  applyRegrip: (token) => solverFrame.applyRegrip(token),
  addMove: (move) => {
    playerSync.addMove(move);
  },
  recordMove: (move, rawMove) => {
    detectedMoves.append(move, rawMove);
  },
  setOrientation: (quaternion) => {
    if (!orientationTracking) return;
    sceneRenderer?.setCubeOrientation(quaternion);
  },
  setPlayerAlgorithm: (algorithm) => {
    playerSync.setAlgorithm(algorithm);
  },
  setInfo: infoPanel.setInfo,
  showInfo: infoPanel.showInfo,
  onSolved: solveAnalysis.complete,
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
  onProtocolEvent: (event) => eventLog.record('cube_event', event),
  onRegrip: (event, solverToken) => {
    eventLog.record('virtual_regrip', { ...event, solverToken });
    syncVirtualFrameOrientation(`⟳ ${solverToken}`);
  },
  onCustomTrigger: (event, solverMove) => {
    eventLog.record('custom_trigger', { ...event, solverMove });
    infoPanel.showFeedback(`Custom trigger detected: ${solverMove}`);
    const { faces } = solverFrame.orientation();
    infoPanel.setActiveGrip(formatGripDescription(faces), `⚡ ${solverMove}`);
  },
  onShake: (event) => {
    eventLog.record('shake_trigger', event);
    infoPanel.showFeedback(`Shake detected: ${event.steps} steps, ${event.reversals} reversals`);
    const { faces } = solverFrame.orientation();
    infoPanel.setActiveGrip(formatGripDescription(faces), '〰 Shake');
  },
  onMoveGap: (event) => {
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
    infoPanel.showFeedback(
      `Missed ${event.missing} move${event.missing === 1 ? '' : 's'}; syncing cube state.`,
    );
  },
  onFacelets: (source) => {
    // Preserve the canonical body-frame snapshot. The solver frame affects
    // move notation and grip presentation only, never copied cube state.
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
  solveAnalysis.onEvent(event);
  if (event.type === 'MOVE') timingDiagnostics.onMove(event);
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
    timingDiagnostics.reset();
    solveAnalysis.reset();
    elapsedClock.reset();
    sceneRenderer?.setActive(false);
    setOrientationTracking(false);
    cubeExportSource = undefined;
    solverFrame.reset();
    syncVirtualFrameOrientation();
    infoPanel.clearInfo();
    detectedMoves.clear();
    infoPanel.setOrientationTrackingAvailable(false);
    infoPanel.setResetOrientationEnabled(false);
    infoPanel.setConnectionStatus('Connecting…');
    return;
  }
  if (state.status === 'connected' && state.connection) {
    if (replay) refreshReplayElapsed();
    else elapsedClock.start();
    const connection = state.connection;
    if (!sceneRenderer) {
      sceneRenderer = startSceneRenderLoop(twistyPlayer, {
        onContextLost: () =>
          infoPanel.showFeedback(
            '3D preview paused after a GPU reset. Waiting for WebGL recovery…',
          ),
        onContextRestored: () => infoPanel.showFeedback('3D preview restored.'),
      });
    } else sceneRenderer.setActive(true);
    infoPanel.setOrientationTrackingAvailable(connection.capabilities.gyroscope);
    setOrientationTracking(connection.capabilities.gyroscope);
    infoPanel.setInfo('deviceName', connection.deviceName);
    infoPanel.setInfo('deviceMAC', connection.deviceMAC || '- n/a -');
    infoPanel.setInfo('protocol', `${connection.protocol.name} (${connection.protocol.id})`);
    infoPanel.setInfo('capabilities', formatCapabilities(connection.capabilities));
    infoPanel.setResetOrientationEnabled(true);
    infoPanel.setConnectionStatus('Connected');
    infoPanel.setConnectLabel('Disconnect');
    if (replay) commandPanel.clear();
    else
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
    if (!replay) {
      elapsedClock.refresh();
      elapsedClock.stop();
    }
    sceneRenderer?.setActive(false);
    setOrientationTracking(false);
    cubeExportSource = undefined;
    commandPanel.clear();
    solverFrame.reset();
    syncVirtualFrameOrientation();
    cubeEvents.reset();
    infoPanel.clearInfo();
    detectedMoves.clear();
    infoPanel.setOrientationTrackingAvailable(false);
    infoPanel.setResetOrientationEnabled(false);
    infoPanel.setConnectionStatus('Disconnected');
    infoPanel.setConnectLabel('Connect');
    return;
  }
  if (state.status === 'error') {
    if (!replay) {
      elapsedClock.refresh();
      elapsedClock.stop();
    }
    sceneRenderer?.setActive(false);
    setOrientationTracking(false);
    cubeExportSource = undefined;
    commandPanel.clear();
    solverFrame.reset();
    syncVirtualFrameOrientation();
    cubeEvents.reset();
    infoPanel.clearInfo();
    detectedMoves.clear();
    infoPanel.setOrientationTrackingAvailable(false);
    infoPanel.setResetOrientationEnabled(false);
    infoPanel.setConnectionStatus(`Failed: ${state.error}`);
    infoPanel.setConnectLabel('Connect');
    alert(`Unable to connect to smart cube: ${state.error}`);
  }
});

infoPanel.on('connect-bluetooth', 'click', async () => {
  const state = session.getState();
  if (state.status === 'connecting') return;
  if (!state.connection) await session.connect();
});

infoPanel.on('disconnect-cube', 'click', async () => {
  if (session.getState().connection) await session.disconnect();
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
  detectedMoves.clear();
});

infoPanel.on('simplify-detected-moves', 'click', () => {
  if (!detectedMoves.simplify()) return;
  infoPanel.showFeedback('Detected moves simplified.');
});

infoPanel.on('copy-detected-moves', 'click', () => {
  void infoPanel
    .copyText(detectedMoves.text())
    .then(() => infoPanel.showFeedback('Detected moves copied.'))
    .catch((error) => {
      console.error('unable to copy detected moves', error);
      infoPanel.showFeedback('Could not copy detected moves.');
    });
});

infoPanel.on('detected-notation-wca', 'click', () => detectedMoves.setNotation('wca'));
infoPanel.on('detected-notation-sign', 'click', () => detectedMoves.setNotation('sign'));
infoPanel.on('detected-notation-sse', 'click', () => detectedMoves.setNotation('sse'));
infoPanel.on('detected-notation-raw-qtm', 'click', () => detectedMoves.setNotation('raw-qtm'));

const cubeExportButton = document.getElementById('copy-cube-state') as HTMLButtonElement;
const cubeExportMenu = document.getElementById('cube-export-menu') as HTMLElement;
const cubeExportDropdown = createDropdownMenu({
  toggle: cubeExportButton,
  menu: cubeExportMenu,
});

function copyCubeExport(format: CubeExportFormat, label: string): void {
  const value = formatCubeExport(cubeExportSource, format);
  cubeExportDropdown.close();
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
infoPanel.on('copy-color-facelets', 'click', () =>
  copyCubeExport('color-facelets', 'Color facelets'),
);
infoPanel.on('copy-singmaster-cycles', 'click', () =>
  copyCubeExport('singmaster-cycles', 'Singmaster cycles'),
);
infoPanel.on('copy-sse-permutation', 'click', () =>
  copyCubeExport('sse-permutation', 'SSE permutation'),
);
infoPanel.on('copy-cubie-coordinates', 'click', () =>
  copyCubeExport('cubie-coordinates', 'CP / CO / EP / EO'),
);
infoPanel.on('copy-kpattern-json', 'click', () => copyCubeExport('kpattern-json', 'KPattern JSON'));
infoPanel.on('copy-regrip-state-json', 'click', () =>
  copyCubeExport('regrip-state-json', 'Regrip state JSON'),
);
infoPanel.on('copy-orbit64', 'click', () => copyCubeExport('orbit64', 'Orbit64 token'));

infoPanel.on('detectedMoves', 'input', () => detectedMoves.edited());

// Subscribe every UI integration before the in-app mock transport publishes
// its initial connection state. The dev harness continues to connect itself.
if (replay && !preseededReplay) void session.connect();
