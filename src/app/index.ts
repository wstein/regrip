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
import { createOrientationUi, formatGripDescription } from './orientationUi';
import { replayHeaderForState, scopedTraceJsonl } from './traceExport';

const sourceRevisionLink = document.getElementById('source-revision');
if (sourceRevisionLink instanceof HTMLAnchorElement) {
  const revision = sourceRevision(__REGRIP_BUILD_SHA__, __REGRIP_BUILD_RELEASE_TAG__);
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
    (['wca', 'sign', 'sse', 'jaap', 'raw-qtm'] as const).forEach((candidate) => {
      document
        .getElementById(`detected-notation-${candidate}`)
        ?.setAttribute('aria-pressed', String(candidate === notation));
    });
  },
  setValidationError: (error) => {
    const editor = document.getElementById('detectedMoves');
    const message = document.getElementById('detected-moves-error');
    if (editor instanceof HTMLTextAreaElement) {
      if (error) editor.setAttribute('aria-invalid', 'true');
      else editor.removeAttribute('aria-invalid');
    }
    if (message) {
      message.textContent = error ?? '';
      message.hidden = error === undefined;
    }
  },
});

infoPanel.mountCube(twistyPlayer);
infoPanel.clearInfo();
detectedMoves.clear();
mountFullscreenToggle();

let sceneRenderer: SceneRenderer | undefined;
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
  diagnosticsAvailable: false,
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
const orientationUi = createOrientationUi({
  orientation: solverFrame.orientation,
  renderer: () => sceneRenderer,
  setActiveGrip: infoPanel.setActiveGrip,
  setTrackingStatus: infoPanel.setOrientationTracking,
});

infoPanel.on('sync-state', 'click', async () => {
  const conn = session.getState().connection;
  if (!conn?.capabilities.facelets) {
    infoPanel.showFeedback('This cube does not support state synchronization.');
    return;
  }
  try {
    cubeEvents.invalidatePlayerState();
    playerPatterns.reset();
    eventLog.record('cube_command', { name: 'Sync state', status: 'sent', error: null });
    await session.syncFacelets();
    infoPanel.showFeedback('Cube state synchronized.');
  } catch (error) {
    eventLog.record('cube_command', {
      name: 'Sync state',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    infoPanel.showFeedback(
      `Could not synchronize cube state: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
});

infoPanel.on('reset-gyro', 'click', async () => {
  if (!orientationUi.isTracking()) {
    orientationUi.resetView();
    infoPanel.showFeedback('View orientation reset.');
    return;
  }
  if (!session.getState().connection?.capabilities.gyroscope) {
    infoPanel.showFeedback('This cube does not support a gyroscope.');
    return;
  }
  session.resetGyro();
  solverFrame.reset();
  orientationUi.syncVirtualFrame();
  infoPanel.showFeedback('Gyro and virtual move frame reset.');
});

infoPanel.on('track-orientation', 'click', () => {
  if (!session.getState().connection?.capabilities.gyroscope) return;
  const nextTracking = !orientationUi.isTracking();
  orientationUi.setTracking(nextTracking);
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
    if (!orientationUi.isTracking()) return;
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
      driftCorrected: event.driftCorrected,
      stabilized: event.stabilized,
    });
  },
  onProtocolEvent: (event) => eventLog.record('cube_event', event),
  onRegrip: (event, solverToken) => {
    eventLog.record('virtual_regrip', { ...event, solverToken });
    orientationUi.syncVirtualFrame(`⟳ ${solverToken}`);
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

function resetSessionUi(): void {
  sceneRenderer?.setActive(false);
  orientationUi.setTracking(false);
  cubeExportSource = undefined;
  solverFrame.reset();
  orientationUi.syncVirtualFrame();
  infoPanel.clearInfo();
  detectedMoves.clear();
  infoPanel.setOrientationTrackingAvailable(false);
  infoPanel.setResetOrientationEnabled(false);
  infoPanel.setSyncStateAvailable(false);
  liveLog.setDiagnosticsAvailable(false);
}

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
    resetSessionUi();
    infoPanel.setConnectionStatus('Connecting…');
    return;
  }
  if (state.status === 'connected' && state.connection) {
    if (replay) refreshReplayElapsed();
    else elapsedClock.start();
    const connection = state.connection;
    liveLog.setDiagnosticsAvailable(connection.diagnostics$ !== undefined);
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
    orientationUi.setTracking(connection.capabilities.gyroscope);
    infoPanel.setSyncStateAvailable(!replay && connection.capabilities.facelets);
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
        sendVendorCommand: session.sendVendorCommand,
        onSend: (name) => {
          eventLog.record('cube_command', { name, status: 'sent', error: null });
        },
        onResult: (name, error) => {
          if (!error) {
            if (name === 'Reset state') {
              playerSync.setAlgorithm('');
              infoPanel.showFeedback('Cube state reset requested.');
            }
            return;
          }
          eventLog.record('cube_command', {
            name,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          if (name === 'Reset state')
            infoPanel.showFeedback(
              `Could not reset cube state: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        },
      });
    return;
  }
  if (state.status === 'disconnected') {
    if (!replay) {
      elapsedClock.refresh();
      elapsedClock.stop();
    }
    commandPanel.clear();
    cubeEvents.reset();
    resetSessionUi();
    infoPanel.setConnectionStatus('Disconnected');
    infoPanel.setConnectLabel('Connect');
    return;
  }
  if (state.status === 'error') {
    if (!replay) {
      elapsedClock.refresh();
      elapsedClock.stop();
    }
    commandPanel.clear();
    cubeEvents.reset();
    resetSessionUi();
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

function currentReplayHeader() {
  return replayHeaderForState(session.getState());
}

const traceExportScope = document.getElementById('trace-export-scope') as HTMLSelectElement;

function currentScopedJsonlLog(): string | undefined {
  const header = currentReplayHeader();
  const result = scopedTraceJsonl({
    scope: traceExportScope.value,
    header,
    all: () => eventLog.toJsonl(header),
    filtered: liveLog.getFilteredEntries().map((entry) => entry.log),
    selected: liveLog.getSelectedEntries().map((entry) => entry.log),
  });
  if (result.error) {
    infoPanel.showFeedback(result.error);
    return undefined;
  }
  return result.contents;
}

infoPanel.on('download-log', 'click', () => {
  const contents = currentScopedJsonlLog();
  if (contents === undefined) return;
  const filename = `smartcube-log-${new Date().toISOString().replace(/:/g, '-')}.jsonl`;
  downloadJsonl(contents, filename);
  infoPanel.showFeedback('Trace downloaded.');
});

infoPanel.on('copy-log', 'click', () => {
  const contents = currentScopedJsonlLog();
  if (contents === undefined) return;
  void infoPanel.copyWithFeedback(contents, 'Trace JSONL');
});

infoPanel.on('clear-detected-moves', 'click', () => {
  detectedMoves.clear();
});

infoPanel.on('simplify-detected-moves', 'click', () => {
  if (!detectedMoves.simplify()) return;
  infoPanel.showFeedback('Detected moves simplified.');
});

infoPanel.on('copy-detected-moves', 'click', () => {
  void infoPanel.copyWithFeedback(detectedMoves.text(), 'Detected moves');
});

infoPanel.on('detected-notation-wca', 'click', () => detectedMoves.setNotation('wca'));
infoPanel.on('detected-notation-sign', 'click', () => detectedMoves.setNotation('sign'));
infoPanel.on('detected-notation-sse', 'click', () => detectedMoves.setNotation('sse'));
infoPanel.on('detected-notation-jaap', 'click', () => detectedMoves.setNotation('jaap'));
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
  void infoPanel.copyWithFeedback(value, label);
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
