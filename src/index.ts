
import './style.css'

import $ from 'jquery';
import { Subscription, interval } from 'rxjs';
import { TwistyPlayer } from 'cubing/twisty';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';

import * as THREE from 'three';

import {
  now,
  connectSmartCube,
  SmartCubeConnection,
  SmartCubeEvent,
  SmartCubeMoveEvent,
  cubeTimestampCalcSkew,
  cubeTimestampLinearFit
} from 'smartcube-web-bluetooth';

import { faceletsToPattern, patternToFacelets, kpuzzleReady } from './utils';
import * as Timer from './Timer.res.mjs';
import * as Time from './Time.res.mjs';
import * as MoveBuffer from './MoveBuffer.res.mjs';
import * as GyroOrientation from './GyroOrientation.res.mjs';

const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

const twistyPlayer = new TwistyPlayer({
  puzzle: '3x3x3',
  visualization: 'PG3D',
  alg: '',
  experimentalSetupAnchor: 'start',
  background: 'none',
  controlPanel: 'none',
  hintFacelets: 'none',
  experimentalDragInput: 'none',
  cameraLatitude: 0,
  cameraLongitude: 0,
  cameraLatitudeLimit: 0,
  tempoScale: 5
});

$('#cube').append(twistyPlayer);

let conn: SmartCubeConnection | null = null;
let eventsSub: Subscription | null = null;
const moves = MoveBuffer.make<SmartCubeMoveEvent>();

let twistyScene: THREE.Scene | undefined;
let twistyVantage: any;

// Resting pose shown before any gyro data; the cube settles to
// GyroOrientation.home once GYRO events start arriving.
const cubeQuaternion = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(30 * Math.PI / 180, -30 * Math.PI / 180, 0)
);
const gyro = GyroOrientation.make();

async function animateCubeOrientation() {
  try {
    if (!twistyScene || !twistyVantage) {
      const vantageList = await twistyPlayer.experimentalCurrentVantages();
      twistyVantage = [...vantageList][0];
      twistyScene = twistyVantage && await twistyVantage.scene.scene();
    }
    if (twistyScene && twistyVantage) {
      twistyScene.quaternion.slerp(cubeQuaternion, 0.25);
      twistyVantage.render();
    }
  } catch (err) {
    console.warn('cube render loop', err);
  }
  requestAnimationFrame(animateCubeOrientation);
}
requestAnimationFrame(animateCubeOrientation);

function handleGyroEvent(event: SmartCubeEvent) {
  if (event.type == "GYRO") {
    let { x: qx, y: qy, z: qz, w: qw } = event.quaternion;
    let target = GyroOrientation.update(gyro, event.quaternion);
    cubeQuaternion.set(target.x, target.y, target.z, target.w);
    $('#quaternion').val(`x: ${qx.toFixed(3)}, y: ${qy.toFixed(3)}, z: ${qz.toFixed(3)}, w: ${qw.toFixed(3)}`);
    if (event.velocity) {
      let { x: vx, y: vy, z: vz } = event.velocity;
      $('#velocity').val(`x: ${vx}, y: ${vy}, z: ${vz}`);
    }
  }
}

function handleMoveEvent(event: SmartCubeEvent) {
  if (event.type == "MOVE") {
    dispatchTimer("moveDetected");
    twistyPlayer.experimentalAddMove(event.move, { cancel: false });
    MoveBuffer.pushRecent(moves, event);
    if (timerState == "running") {
      MoveBuffer.pushSolution(moves, event);
    }
    if (MoveBuffer.recentReady(moves)) {
      const skew = cubeTimestampCalcSkew(MoveBuffer.recentMoves(moves));
      $('#skew').val(skew + '%');
    }
  }
}

let cubeStateInitialized = false;

async function handleFaceletsEvent(event: SmartCubeEvent) {
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
    $('#hardwareName').val(event.hardwareName || '- n/a -');
    $('#hardwareVersion').val(event.hardwareVersion || '- n/a -');
    $('#softwareVersion').val(event.softwareVersion || '- n/a -');
    $('#productDate').val(event.productDate || '- n/a -');
    $('#gyroSupported').val(event.gyroSupported ? "YES" : "NO");
  } else if (event.type == "BATTERY") {
    $('#batteryLevel').val(event.batteryLevel + '%');
  } else if (event.type == "DISCONNECT") {
    eventsSub?.unsubscribe();
    eventsSub = null;
    conn = null;
    cubeStateInitialized = false;
    MoveBuffer.reset(moves);
    GyroOrientation.resetBasis(gyro);
    dispatchTimer("disconnected");
    twistyPlayer.alg = '';
    $('.info input').val('- n/a -');
    $('#connect').html('Connect');
  }
}

const customMacAddressProvider = async (device: BluetoothDevice, isFallbackCall?: boolean): Promise<string | null> => {
  if (isFallbackCall) {
    return prompt('Unable do determine cube MAC address!\nPlease enter MAC address manually:');
  } else {
    return typeof device.watchAdvertisements == 'function' ? null :
      prompt('Seems like your browser does not support Web Bluetooth watchAdvertisements() API. Enable following flag in Chrome:\n\nchrome://flags/#enable-experimental-web-platform-features\n\nor enter cube MAC address manually:');
  }
};

$('#reset-state').on('click', async () => {
  if (conn?.capabilities.reset) {
    await conn.sendCommand({ type: "REQUEST_RESET" });
  }
  twistyPlayer.alg = '';
});

$('#reset-gyro').on('click', async () => {
  GyroOrientation.resetBasis(gyro);
});

async function disconnectCube() {
  eventsSub?.unsubscribe();
  eventsSub = null;
  const c = conn;
  conn = null;
  await c?.disconnect().catch(() => {});
}

$('#connect').on('click', async () => {
  if (conn) {
    await disconnectCube();
    return;
  }
  let connection: SmartCubeConnection | undefined;
  try {
    connection = await connectSmartCube(customMacAddressProvider);
    eventsSub = connection.events$.subscribe(handleCubeEvent);
    if (connection.capabilities.hardware) {
      await connection.sendCommand({ type: "REQUEST_HARDWARE" });
    }
    if (connection.capabilities.facelets) {
      await connection.sendCommand({ type: "REQUEST_FACELETS" });
    }
    if (connection.capabilities.battery) {
      await connection.sendCommand({ type: "REQUEST_BATTERY" });
    }
    // Only now is the connection fully usable.
    conn = connection;
    $('#deviceName').val(connection.deviceName);
    $('#deviceMAC').val(connection.deviceMAC || '- n/a -');
    $('#connect').html('Disconnect');
  } catch (error) {
    eventsSub?.unsubscribe();
    eventsSub = null;
    await connection?.disconnect().catch(() => {});
    conn = null;
    console.error('Unable to connect to smart cube', error);
    const message = error instanceof Error ? error.message : String(error);
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
      case "showTimer": $('#timer').show(); break;
      case "hideTimer": $('#timer').hide(); break;
      case "startLocalTimer": startLocalTimer(); break;
      case "stopLocalTimer": stopLocalTimer(); break;
      case "clearSolutionMoves": MoveBuffer.clearSolution(moves); break;
      case "showFinalTime": {
        const fitted = cubeTimestampLinearFit(MoveBuffer.solutionMoves(moves));
        setTimerValue(fitted.at(-1)?.cubeTimestamp ?? 0);
        break;
      }
    }
  } else {
    switch (effect.kind) {
      case "setPhase": $('#timer').css('color', PHASE_COLOR[effect.phase.kind]); break;
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
  $('#timer').html(Time.format(timestamp));
}

let localTimer: Subscription | null = null;
function startLocalTimer() {
  const startTime = now();
  localTimer = interval(30).subscribe(() => {
    setTimerValue(now() - startTime);
  });
}

function stopLocalTimer() {
  localTimer?.unsubscribe();
  localTimer = null;
}

$(document).on('keydown', (event) => {
  if (event.key === ' ') {
    event.preventDefault();
    dispatchTimer("activate");
  }
});

$("#cube").on('touchstart', () => {
  dispatchTimer("activate");
});
