// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearActiveGrip,
  clearInfo,
  copyText,
  getDetectedMoves,
  mountCube,
  on,
  renderSolveAnalysis,
  setActiveGrip,
  setConnectLabel,
  setConnectionStatus,
  setDetectedMoves,
  setDetectedMoveCount,
  setInfo,
  setOrientationTracking,
  setOrientationTrackingAvailable,
  setResetOrientationEnabled,
  showFeedback,
  showInfo,
  syncDetectedMovesHighlight,
} from './infoPanel';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
    expect(tracker.title).toContain('gyroscope');
    expect(resetGyro.title).toContain('Connect a cube');

    setOrientationTrackingAvailable(true);
    setOrientationTracking(true);
    setResetOrientationEnabled(true);
    expect(tracker.disabled).toBe(false);
    expect(tracker.getAttribute('aria-pressed')).toBe('true');
    expect(resetGyro.textContent).toBe('Reset gyro');
    expect(resetGyro.disabled).toBe(false);
    expect(tracker.title).toContain('3D view');
    expect(resetGyro.title).toContain('orientation');

    setOrientationTracking(false);
    expect(tracker.getAttribute('aria-pressed')).toBe('false');
    expect(resetGyro.textContent).toBe('Reset view');
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

    const textarea = document.querySelector<HTMLTextAreaElement>('#detectedMoves')!;
    textarea.scrollTop = 12;
    textarea.scrollLeft = 8;
    textarea.dispatchEvent(new Event('scroll'));
    expect(container.scrollTop).toBe(12);
    expect(container.scrollLeft).toBe(8);
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

describe('panel primitives', () => {
  it('renders connection, move, solve, mount, and event state', () => {
    document.body.innerHTML = `
      <button id="connect" data-mock-active="true"></button>
      <button id="connect-bluetooth"></button><button id="disconnect-cube"></button>
      <input id="connectionStatus"><span id="moveCount"></span>
      <textarea id="detectedMoves"></textarea><div id="detected-moves-highlight"></div>
      <span id="sessionElapsed"></span><span id="solve-analysis-status"></span>
      <span id="solve-duration"></span><span id="solve-tps"></span><span id="solve-moves"></span>
      <span id="solve-regrips"></span><span id="solve-triggers"></span><span id="solve-longest-pause"></span>
      <div id="cube"></div><button id="probe"></button>`;

    setConnectLabel('Disconnect');
    expect(document.querySelector('#connect')?.textContent).toBe('Replay mode ▾');
    setConnectLabel('Connect');
    setConnectionStatus('Connecting…');
    expect(document.querySelector<HTMLInputElement>('#connectionStatus')?.dataset.state).toBe(
      'connecting-',
    );
    setDetectedMoves('R U');
    setDetectedMoveCount(2);
    expect(getDetectedMoves()).toBe('R U');
    expect(document.querySelector('#moveCount')?.textContent).toBe('2');
    renderSolveAnalysis({
      status: 'complete',
      durationMs: 1500,
      tps: 2,
      moveCount: 3,
      qtm: 4,
      regrips: 1,
      triggers: 2,
      longestPauseMs: 500,
    });
    expect(document.querySelector('#solve-analysis-status')?.textContent).toBe('Complete');
    const child = document.createElement('span');
    mountCube(child);
    expect(document.querySelector('#cube')?.firstChild).toBe(child);
    const listener = vi.fn();
    on('probe', 'click', listener);
    document.querySelector<HTMLButtonElement>('#probe')?.click();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('times feedback and gestures and falls back when Clipboard is unavailable', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="app-feedback" hidden></div>
      <span id="grip-value"></span><span id="grip-gesture" hidden></span>`;
    showFeedback('Saved');
    setActiveGrip('Home', 'Shake');
    vi.advanceTimersByTime(3200);
    expect(document.querySelector<HTMLElement>('#app-feedback')?.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('#grip-gesture')?.hidden).toBe(true);

    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const copy = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: copy, configurable: true });
    await copyText('fallback');
    expect(copy).toHaveBeenCalledWith('copy');
    expect(document.querySelector('body > textarea')).toBeNull();
  });

  it('reports missing typed elements and labels', () => {
    document.body.innerHTML =
      '<div id="deviceName"></div><input id="detectedMoves"><input id="offlineMoves">';
    expect(() => setInfo('deviceName', 'cube')).toThrow('Missing input #deviceName');
    expect(() => setDetectedMoves('R')).toThrow('Missing textarea #detectedMoves');
    expect(() => showInfo('offlineMoves')).toThrow('Missing label for #offlineMoves');
  });
});
