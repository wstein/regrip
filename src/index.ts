
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

var twistyPlayer = new TwistyPlayer({
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

var conn: SmartCubeConnection | null;
const moves = MoveBuffer.make<SmartCubeMoveEvent>();

var twistyScene: THREE.Scene;
var twistyVantage: any;

var cubeQuaternion: THREE.Quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(30 * Math.PI / 180, -30 * Math.PI / 180, 0));
const gyro = GyroOrientation.make();

async function amimateCubeOrientation() {
  if (!twistyScene || !twistyVantage) {
    var vantageList = await twistyPlayer.experimentalCurrentVantages();
    twistyVantage = [...vantageList][0];
    twistyScene = await twistyVantage.scene.scene();
  }
  twistyScene.quaternion.slerp(cubeQuaternion, 0.25);
  twistyVantage.render();
  requestAnimationFrame(amimateCubeOrientation);
}
requestAnimationFrame(amimateCubeOrientation);

async function handleGyroEvent(event: SmartCubeEvent) {
  if (event.type == "GYRO") {
    let { x: qx, y: qy, z: qz, w: qw } = event.quaternion;
    let target = GyroOrientation.update(gyro, qx, qy, qz, qw);
    cubeQuaternion.set(target.x, target.y, target.z, target.w);
    $('#quaternion').val(`x: ${qx.toFixed(3)}, y: ${qy.toFixed(3)}, z: ${qz.toFixed(3)}, w: ${qw.toFixed(3)}`);
    if (event.velocity) {
      let { x: vx, y: vy, z: vz } = event.velocity;
      $('#velocity').val(`x: ${vx}, y: ${vy}, z: ${vz}`);
    }
  }
}

async function handleMoveEvent(event: SmartCubeEvent) {
  if (event.type == "MOVE") {
    dispatchTimer("MoveDetected");
    twistyPlayer.experimentalAddMove(event.move, { cancel: false });
    MoveBuffer.pushRecent(moves, event);
    if (timerState == "Running") {
      MoveBuffer.pushSolution(moves, event);
    }
    if (MoveBuffer.recentReady(moves)) {
      var skew = cubeTimestampCalcSkew(MoveBuffer.recentMoves(moves));
      $('#skew').val(skew + '%');
    }
  }
}

var cubeStateInitialized = false;

async function handleFaceletsEvent(event: SmartCubeEvent) {
  if (event.type == "FACELETS" && !cubeStateInitialized) {
    if (event.facelets != SOLVED_STATE) {
      await kpuzzleReady;
      var kpattern = faceletsToPattern(event.facelets);
      var solution = await experimentalSolve3x3x3IgnoringCenters(kpattern);
      var scramble = solution.invert();
      twistyPlayer.alg = scramble;
    } else {
      twistyPlayer.alg = '';
    }
    cubeStateInitialized = true;
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
    handleFaceletsEvent(event);
  } else if (event.type == "HARDWARE") {
    $('#hardwareName').val(event.hardwareName || '- n/a -');
    $('#hardwareVersion').val(event.hardwareVersion || '- n/a -');
    $('#softwareVersion').val(event.softwareVersion || '- n/a -');
    $('#productDate').val(event.productDate || '- n/a -');
    $('#gyroSupported').val(event.gyroSupported ? "YES" : "NO");
  } else if (event.type == "BATTERY") {
    $('#batteryLevel').val(event.batteryLevel + '%');
  } else if (event.type == "DISCONNECT") {
    conn = null;
    cubeStateInitialized = false;
    MoveBuffer.reset(moves);
    GyroOrientation.resetBasis(gyro);
    dispatchTimer("Disconnected");
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

$('#connect').on('click', async () => {
  if (conn) {
    await conn.disconnect();
    conn = null;
  } else {
    try {
      const connection = await connectSmartCube(customMacAddressProvider);
      conn = connection;
      connection.events$.subscribe(handleCubeEvent);
      if (connection.capabilities.hardware) {
        await connection.sendCommand({ type: "REQUEST_HARDWARE" });
      }
      if (connection.capabilities.facelets) {
        await connection.sendCommand({ type: "REQUEST_FACELETS" });
      }
      if (connection.capabilities.battery) {
        await connection.sendCommand({ type: "REQUEST_BATTERY" });
      }
      $('#deviceName').val(connection.deviceName);
      $('#deviceMAC').val(connection.deviceMAC || '- n/a -');
      $('#connect').html('Disconnect');
    } catch (error) {
      conn = null;
      console.error('Unable to connect to smart cube', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`Unable to connect to smart cube: ${message}`);
    }
  }
});

var timerState: Timer.State = "Idle";

// Feed an input to the Timer state machine and apply the effects it returns.
function dispatchTimer(input: Timer.Input) {
  const [next, effects] = Timer.step(timerState, input, !!conn);
  timerState = next;
  effects.forEach(applyTimerEffect);
}

function applyTimerEffect(effect: Timer.Effect) {
  if (typeof effect == "string") {
    switch (effect) {
      case "ShowTimer": $('#timer').show(); break;
      case "HideTimer": $('#timer').hide(); break;
      case "StartLocalTimer": startLocalTimer(); break;
      case "StopLocalTimer": stopLocalTimer(); break;
      case "ClearSolutionMoves": MoveBuffer.clearSolution(moves); break;
      case "ShowFinalTime": {
        var fittedMoves = cubeTimestampLinearFit(MoveBuffer.solutionMoves(moves));
        var lastMove = fittedMoves.slice(-1).pop();
        setTimerValue(lastMove ? lastMove.cubeTimestamp! : 0);
        break;
      }
    }
  } else {
    switch (effect.TAG) {
      case "SetColor": $('#timer').css('color', effect._0); break;
      case "SetValueMs": setTimerValue(effect._0); break;
    }
  }
}

twistyPlayer.experimentalModel.currentPattern.addFreshListener(async (kpattern) => {
  var facelets = patternToFacelets(kpattern);
  if (facelets == SOLVED_STATE) {
    dispatchTimer("Solved");
    twistyPlayer.alg = '';
  }
});

function setTimerValue(timestamp: number) {
  $('#timer').html(Time.format(timestamp));
}

var localTimer: Subscription | null = null;
function startLocalTimer() {
  var startTime = now();
  localTimer = interval(30).subscribe(() => {
    setTimerValue(now() - startTime);
  });
}

function stopLocalTimer() {
  localTimer?.unsubscribe();
  localTimer = null;
}

$(document).on('keydown', (event) => {
  if (event.which == 32) {
    event.preventDefault();
    dispatchTimer("Activate");
  }
});

$("#cube").on('touchstart', () => {
  dispatchTimer("Activate");
});
