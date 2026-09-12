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
  syncDetectedMovesHighlight,
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

  it('manages cubie-state-panel visibility on showInfo and clearInfo', () => {
    document.body.innerHTML = `
      <section class="cubie-state-panel" hidden>
        <label for="cubieState" hidden>Singmaster Cycles</label>
        <input id="cubieState" type="text" readonly value="- n/a -" hidden />
      </section>
      <textarea id="detectedMoves"></textarea>
      <span id="moveCount">0</span>
    `;
    const panel = document.querySelector<HTMLElement>('.cubie-state-panel')!;
    const input = document.querySelector<HTMLInputElement>('#cubieState')!;

    expect(panel.hidden).toBe(true);
    showInfo('cubieState');
    expect(panel.hidden).toBe(false);
    expect(input.hidden).toBe(false);

    clearInfo();
    expect(panel.hidden).toBe(true);
    expect(input.hidden).toBe(true);
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

describe('detected moves syntax highlighting editor', () => {
  it('renders syntax-highlighted tokens inside the editor backdrop preserving whitespace', () => {
    document.body.innerHTML = `
      <div class="detected-moves-editor">
        <div id="detected-moves-highlight" class="detected-moves-highlight" aria-hidden="true"></div>
        <textarea id="detectedMoves">R U' F2\nM y x z' CR CU CF</textarea>
      </div>
    `;
    syncDetectedMovesHighlight();

    const container = document.querySelector<HTMLElement>('#detected-moves-highlight')!;
    const tokens = container.querySelectorAll<HTMLElement>('.move-token');
    expect(tokens.length).toBe(10);

    // Text content matches full input including newlines
    expect(container.textContent).toBe("R U' F2\nM y x z' CR CU CF");

    expect(tokens[0].textContent).toBe('R');
    expect(tokens[0].dataset.face).toBe('R');
    expect(tokens[0].classList.contains('is-rotation')).toBe(false);

    expect(tokens[1].textContent).toBe("U'");
    expect(tokens[1].dataset.face).toBe('U');
    expect(tokens[1].classList.contains('is-rotation')).toBe(false);

    expect(tokens[2].textContent).toBe('F2');
    expect(tokens[2].dataset.face).toBe('F');
    expect(tokens[2].classList.contains('is-rotation')).toBe(false);

    expect(tokens[3].textContent).toBe('M');
    expect(tokens[3].dataset.face).toBe('M');
    expect(tokens[3].classList.contains('is-rotation')).toBe(false);

    // y rotates around U axis
    expect(tokens[4].textContent).toBe('y');
    expect(tokens[4].dataset.face).toBe('U');
    expect(tokens[4].classList.contains('is-rotation')).toBe(true);

    // x rotates around R axis
    expect(tokens[5].textContent).toBe('x');
    expect(tokens[5].dataset.face).toBe('R');
    expect(tokens[5].classList.contains('is-rotation')).toBe(true);

    // z rotates around F axis
    expect(tokens[6].textContent).toBe("z'");
    expect(tokens[6].dataset.face).toBe('F');
    expect(tokens[6].classList.contains('is-rotation')).toBe(true);

    // CR rotates around R axis
    expect(tokens[7].textContent).toBe('CR');
    expect(tokens[7].dataset.face).toBe('R');
    expect(tokens[7].classList.contains('is-rotation')).toBe(true);

    // CU rotates around U axis
    expect(tokens[8].textContent).toBe('CU');
    expect(tokens[8].dataset.face).toBe('U');
    expect(tokens[8].classList.contains('is-rotation')).toBe(true);

    // CF rotates around F axis
    expect(tokens[9].textContent).toBe('CF');
    expect(tokens[9].dataset.face).toBe('F');
    expect(tokens[9].classList.contains('is-rotation')).toBe(true);
  });

  it('renders wide moves and trigger separators', () => {
    document.body.innerHTML = `
      <div class="detected-moves-editor">
        <div id="detected-moves-highlight" class="detected-moves-highlight" aria-hidden="true"></div>
        <textarea id="detectedMoves">U2 Dw2 · R L · B2 D2</textarea>
      </div>
    `;
    syncDetectedMovesHighlight();

    const container = document.querySelector<HTMLElement>('#detected-moves-highlight')!;
    const tokens = container.querySelectorAll<HTMLElement>('.move-token');
    const separators = container.querySelectorAll<HTMLElement>('.move-separator');

    expect(tokens.length).toBe(6);
    expect(separators.length).toBe(2);

    expect(tokens[0].textContent).toBe('U2');
    expect(tokens[0].dataset.face).toBe('U');

    expect(tokens[1].textContent).toBe('Dw2');
    expect(tokens[1].dataset.face).toBe('D');

    expect(separators[0].textContent).toBe('·');

    expect(tokens[2].textContent).toBe('R');
    expect(tokens[2].dataset.face).toBe('R');

    expect(tokens[3].textContent).toBe('L');
    expect(tokens[3].dataset.face).toBe('L');

    expect(separators[1].textContent).toBe('·');

    expect(tokens[4].textContent).toBe('B2');
    expect(tokens[4].dataset.face).toBe('B');

    expect(tokens[5].textContent).toBe('D2');
    expect(tokens[5].dataset.face).toBe('D');
  });

  it('renders an empty state when no moves exist in the editor', () => {
    document.body.innerHTML = `
      <div class="detected-moves-editor">
        <div id="detected-moves-highlight" class="detected-moves-highlight" aria-hidden="true"></div>
        <textarea id="detectedMoves"></textarea>
      </div>
    `;
    syncDetectedMovesHighlight();

    const container = document.querySelector<HTMLElement>('#detected-moves-highlight')!;
    expect(container.querySelectorAll('.move-token').length).toBe(0);
    expect(container.textContent).toBe('');
  });
});
