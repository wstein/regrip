// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  clearActiveGrip,
  clearInfo,
  countDetectedMoves,
  setActiveGrip,
  setInfo,
  setOrientationTracking,
  setOrientationTrackingAvailable,
  setResetOrientationEnabled,
  setTimerButtonState,
  setTps,
  showInfo,
} from './infoPanel';

describe('countDetectedMoves', () => {
  it('counts editable whitespace-delimited move and virtual-regrip tokens', () => {
    expect(countDetectedMoves("  R  U'\ny  x2  ")).toBe(4);
    expect(countDetectedMoves('   ')).toBe(0);
  });
});

describe('orientation controls', () => {
  it('enables tracking only for gyro cubes and changes reset to the active orientation mode', () => {
    document.body.innerHTML =
      '<button id="track-orientation" aria-pressed="false"></button><button id="reset-gyro"></button>';
    const tracker = document.querySelector<HTMLButtonElement>('#track-orientation')!;
    const resetGyro = document.querySelector<HTMLButtonElement>('#reset-gyro')!;

    setOrientationTrackingAvailable(false);
    setResetOrientationEnabled(false);
    expect(tracker.disabled).toBe(true);
    expect(resetGyro.disabled).toBe(true);

    setOrientationTrackingAvailable(true);
    setOrientationTracking(true);
    setResetOrientationEnabled(true);
    expect(tracker.disabled).toBe(false);
    expect(tracker.getAttribute('aria-pressed')).toBe('true');
    expect(resetGyro.textContent).toBe('Reset Gyro');
    expect(resetGyro.disabled).toBe(false);

    setOrientationTracking(false);
    expect(tracker.getAttribute('aria-pressed')).toBe('false');
    expect(resetGyro.textContent).toBe('Reset View');
  });
});

describe('telemetry info panel', () => {
  it('updates input value, title tooltip, and data-na attribute', () => {
    document.body.innerHTML = `
      <div class="info">
        <label for="deviceName">Device Name</label>
        <input id="deviceName" type="text" readonly value="- n/a -" />
      </div>
    `;
    const el = document.querySelector<HTMLInputElement>('#deviceName')!;
    setInfo('deviceName', 'GoCube Edge');
    expect(el.value).toBe('GoCube Edge');
    expect(el.title).toBe('GoCube Edge');
    expect(el.dataset.na).toBe('false');

    setInfo('deviceName', '- n/a -');
    expect(el.value).toBe('- n/a -');
    expect(el.title).toBe('- n/a -');
    expect(el.dataset.na).toBe('true');
  });

  it('manages offline section title visibility on showInfo and clearInfo', () => {
    document.body.innerHTML = `
      <div class="info">
        <div id="info-offline-title" hidden>Offline</div>
        <label for="offlineMoves" hidden>Offline Moves</label>
        <input id="offlineMoves" type="text" readonly value="- n/a -" hidden />
      </div>
      <textarea id="detectedMoves"></textarea>
      <span id="moveCount">0</span>
    `;
    const title = document.querySelector<HTMLElement>('#info-offline-title')!;
    const input = document.querySelector<HTMLInputElement>('#offlineMoves')!;
    const label = document.querySelector<HTMLLabelElement>('label[for="offlineMoves"]')!;

    expect(title.hidden).toBe(true);
    expect(input.hidden).toBe(true);
    expect(label.hidden).toBe(true);

    showInfo('offlineMoves');
    expect(title.hidden).toBe(false);
    expect(input.hidden).toBe(false);
    expect(label.hidden).toBe(false);

    clearInfo();
    expect(title.hidden).toBe(true);
    expect(input.hidden).toBe(true);
    expect(label.hidden).toBe(true);
    expect(input.dataset.na).toBe('true');
  });
});

describe('grip status indicator', () => {
  it('updates grip value and reveals gesture badge', () => {
    document.body.innerHTML = `
      <div id="grip-status">
        <span id="grip-value">Home</span>
        <span id="grip-gesture" hidden></span>
      </div>
    `;
    const value = document.querySelector<HTMLElement>('#grip-value')!;
    const gesture = document.querySelector<HTMLElement>('#grip-gesture')!;

    setActiveGrip('y (F: Red)');
    expect(value.textContent).toBe('y (F: Red)');
    expect(gesture.hidden).toBe(true);

    setActiveGrip('y (F: Red)', 'Regrip: y');
    expect(value.textContent).toBe('y (F: Red)');
    expect(gesture.textContent).toBe('Regrip: y');
    expect(gesture.hidden).toBe(false);

    clearActiveGrip();
    expect(value.textContent).toBe('Home');
    expect(gesture.hidden).toBe(true);
  });
});

describe('timer button state and TPS indicator', () => {
  it('updates timer button text and dataset state through lifecycle phases', () => {
    document.body.innerHTML = `
      <button id="start-timer" type="button" class="start-timer-cta" disabled>
        Scramble cube to arbitrary state, then press here to start the solving timer...
      </button>
    `;
    const btn = document.querySelector<HTMLButtonElement>('#start-timer')!;

    setTimerButtonState('ready');
    expect(btn.dataset.timerState).toBe('ready');
    expect(btn.textContent).toContain('Ready: Turn any face');

    setTimerButtonState('running');
    expect(btn.dataset.timerState).toBe('running');
    expect(btn.textContent).toContain('Solving in progress');

    setTimerButtonState('stopped', '12.345');
    expect(btn.dataset.timerState).toBe('stopped');
    expect(btn.textContent).toContain('Solved in 12.345');

    setTimerButtonState('idle');
    expect(btn.dataset.timerState).toBe('idle');
    expect(btn.textContent).toContain('Scramble cube to arbitrary state');
  });

  it('updates TPS metric display and toggles visibility', () => {
    document.body.innerHTML = `
      <span id="tps-container" class="tps-count" hidden>
        <strong id="tpsValue">0.0</strong> TPS
      </span>
    `;
    const container = document.querySelector<HTMLElement>('#tps-container')!;
    const value = document.querySelector<HTMLElement>('#tpsValue')!;

    setTps(4.25);
    expect(container.hidden).toBe(false);
    expect(value.textContent).toBe('4.3');

    setTps(null);
    expect(container.hidden).toBe(true);
  });
});
