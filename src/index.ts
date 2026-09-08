
import './style.css'

import type { Subscription } from 'rxjs';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';

import * as THREE from 'three';

import {
  SmartCubeConnection,
  SmartCubeEvent,
  SmartCubeMoveEvent
} from 'smartcube-web-bluetooth';

import { faceletsToPattern, patternToFacelets, kpuzzleReady } from './utils';
import * as Timer from './Timer.res.mjs';
import * as Time from './Time.res.mjs';
import * as MoveBuffer from './MoveBuffer.res.mjs';
import * as GyroOrientation from './GyroOrientation.res.mjs';
import * as infoPanel from './infoPanel';
import { twistyPlayer } from './twistyPlayer';
import { startSceneRenderLoop } from './sceneView';
import { connectCube, disconnectCube as closeCube, requestInitialState } from './connection';
import { createLocalTimer } from './timerController';
import { formatCapabilities, formatCubieState, formatOfflineStats } from './cubeInfo';

const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

infoPanel.mountCube(twistyPlayer);

let conn: SmartCubeConnection | null = null;
let eventsSub: Subscription | null = null;
const moves = MoveBuffer.make<SmartCubeMoveEvent>();

// Resting pose shown before any gyro data; the cube settles to
// GyroOrientation.home once GYRO events start arriving.
const cubeQuaternion = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(30 * Math.PI / 180, -30 * Math.PI / 180, 0)
);
const gyro = GyroOrientation.make();

startSceneRenderLoop(twistyPlayer, cubeQuaternion);

function handleGyroEvent(event: SmartCubeEvent) {
  if (event.type == "GYRO") {
    let { x: qx, y: qy, z: qz, w: qw } = event.quaternion;
    let target = GyroOrientation.update(gyro, event.quaternion);
    cubeQuaternion.set(target.x, target.y, target.z, target.w);
    infoPanel.setInfo('quaternion', `x: ${qx.toFixed(3)}, y: ${qy.toFixed(3)}, z: ${qz.toFixed(3)}, w: ${qw.toFixed(3)}`);
    if (event.velocity) {
      let { x: vx, y: vy, z: vz } = event.velocity;
      infoPanel.setInfo('velocity', `x: ${vx}, y: ${vy}, z: ${vz}`);
    }
  }
}

function handleMoveEvent(event: SmartCubeEvent) {
  if (event.type == "MOVE") {
    dispatchTimer("moveDetected");
    twistyPlayer.experimentalAddMove(event.move, { cancel: false });
    if (event.serial !== undefined) {
      infoPanel.setInfo('eventSerial', String(event.serial));
    }
    if (event.goCubeCenterOrientation !== undefined) {
      infoPanel.setInfo('centerOrientation', String(event.goCubeCenterOrientation));
    }
    if (event.cubeTimestamp === null) {
      infoPanel.setInfo('skew', '- n/a - (cube clock unavailable)');
    } else {
      MoveBuffer.pushRecent(moves, event);
    }
    if (timerState == "running") {
      MoveBuffer.pushSolution(moves, event);
    }
    if (MoveBuffer.recentReady(moves)) {
      const skew = MoveBuffer.recentSkew(moves);
      infoPanel.setInfo('skew', skew + '%');
    }
  }
}

let cubeStateInitialized = false;

async function handleFaceletsEvent(event: SmartCubeEvent) {
  if (event.type == "FACELETS") {
    if (event.serial !== undefined) {
      infoPanel.setInfo('eventSerial', String(event.serial));
    }
    if (event.state) {
      infoPanel.setInfo('cubieState', formatCubieState(event.state));
    }
  }
  if (event.type == "FACELETS" && !cubeStateInitialized) {
    cubeStateInitialized = true; // set before awaiting so re-entrant events are ignored
    if (event.facelets != SOLVED_STATE) {
      await kpuzzleReady;
      const kpattern = faceletsToPattern(event.facelets);
      const solution = await experimentalSolve3x3x3IgnoringCenters(kpattern);
      twistyPlayer.alg = solution.invert();
    } else {
      twistyPlayer.alg = '';
    }
    console.log("Initial cube state is applied successfully", event.facelets);
  }
}

function handleCubeEvent(event: SmartCubeEvent) {
  if (event.type != "GYRO")
    console.log("SmartCubeEvent", event);
  if (event.type == "GYRO") {
    handleGyroEvent(event);
  } else if (event.type == "MOVE") {
    handleMoveEvent(event);
  } else if (event.type == "FACELETS") {
    handleFaceletsEvent(event).catch(err => console.error('facelets handler failed', err));
  } else if (event.type == "HARDWARE") {
    if (event.hardwareName !== undefined) infoPanel.setInfo('hardwareName', event.hardwareName);
    if (event.hardwareVersion !== undefined) infoPanel.setInfo('hardwareVersion', event.hardwareVersion);
    if (event.softwareVersion !== undefined) infoPanel.setInfo('softwareVersion', event.softwareVersion);
    if (event.productDate !== undefined) infoPanel.setInfo('productDate', event.productDate);
    if (event.gyroSupported !== undefined) infoPanel.setInfo('gyroSupported', event.gyroSupported ? "YES" : "NO");
    if (event.goCubeType) {
      infoPanel.setInfo('goCubeType', `${event.goCubeType.name} (${event.goCubeType.code})`);
    }
    if (event.goCubeOfflineStats) {
      const stats = formatOfflineStats(event.goCubeOfflineStats);
      infoPanel.setInfo('offlineMoves', stats.moves);
      infoPanel.setInfo('offlineDuration', stats.duration);
      infoPanel.setInfo('offlineSolves', stats.solves);
    }
  } else if (event.type == "BATTERY") {
    infoPanel.setInfo('batteryLevel', event.batteryLevel + '%');
  } else if (event.type == "DISCONNECT") {
    eventsSub?.unsubscribe();
    eventsSub = null;
    conn = null;
    cubeStateInitialized = false;
    MoveBuffer.reset(moves);
    GyroOrientation.resetBasis(gyro);
    dispatchTimer("disconnected");
    twistyPlayer.alg = '';
    infoPanel.clearInfo();
    infoPanel.setConnectionStatus('Disconnected');
    infoPanel.setConnectLabel('Connect');
  }
}

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
  await closeCube(c);
  cubeStateInitialized = false;
  MoveBuffer.reset(moves);
  GyroOrientation.resetBasis(gyro);
  dispatchTimer("disconnected");
  twistyPlayer.alg = '';
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
    eventsSub = connection.events$.subscribe(handleCubeEvent);
    await requestInitialState(connection);
    // Only now is the connection fully usable.
    conn = connection;
    infoPanel.setInfo('deviceName', connection.deviceName);
    infoPanel.setInfo('deviceMAC', connection.deviceMAC || '- n/a -');
    infoPanel.setInfo('protocol', `${connection.protocol.name} (${connection.protocol.id})`);
    infoPanel.setInfo('capabilities', formatCapabilities(connection.capabilities));
    infoPanel.setConnectionStatus('Connected');
    infoPanel.setConnectLabel('Disconnect');
  } catch (error) {
    eventsSub?.unsubscribe();
    eventsSub = null;
    await closeCube(connection ?? null);
    conn = null;
    console.error('Unable to connect to smart cube', error);
    const message = error instanceof Error ? error.message : String(error);
    infoPanel.setConnectionStatus(`Failed: ${message}`);
    infoPanel.setConnectLabel('Connect');
    alert(`Unable to connect to smart cube: ${message}`);
  }
});

let timerState: Timer.State = "idle";

const PHASE_COLOR: Record<Timer.Phase["kind"], string> = {
  ready: "#0f0",
  running: "#999",
  stopped: "#fff",
};

// Feed an input to the Timer state machine and apply the effects it returns.
function dispatchTimer(input: Timer.Input) {
  const [next, effects] = Timer.step(timerState, input, !!conn);
  timerState = next;
  effects.forEach(applyTimerEffect);
}

function applyTimerEffect(effect: Timer.Effect) {
  if (typeof effect == "string") {
    switch (effect) {
      case "showTimer": infoPanel.showTimer(true); break;
      case "hideTimer": infoPanel.showTimer(false); break;
      case "startLocalTimer": localTimer.start(); break;
      case "stopLocalTimer": localTimer.stop(); break;
      case "clearSolutionMoves": MoveBuffer.clearSolution(moves); break;
      case "showFinalTime": {
        const fitted = MoveBuffer.fittedSolution(moves);
        setTimerValue(fitted.at(-1)?.cubeTimestamp ?? 0);
        break;
      }
    }
  } else {
    switch (effect.kind) {
      case "setPhase": infoPanel.setTimerColor(PHASE_COLOR[effect.phase.kind]); break;
      case "setValueMs": setTimerValue(effect.ms); break;
    }
  }
}

twistyPlayer.experimentalModel.currentPattern.addFreshListener(async (kpattern) => {
  const facelets = patternToFacelets(kpattern);
  if (facelets == SOLVED_STATE) {
    dispatchTimer("solved");
    twistyPlayer.alg = '';
  }
});

function setTimerValue(timestamp: number) {
  infoPanel.setTimer(Time.format(timestamp));
}

const localTimer = createLocalTimer(setTimerValue);

document.addEventListener('keydown', (event) => {
  if (event.key === ' ') {
    event.preventDefault();
    dispatchTimer("activate");
  }
});

infoPanel.on('cube', 'touchstart', () => {
  dispatchTimer("activate");
});
