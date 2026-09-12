import { byId } from './dom';

const notAvailable = '- n/a -';
const optionalInfoIds = [
  'eventSerial',
  'cubieState',
  'centerOrientation',
  'goCubeType',
  'offlineMoves',
  'offlineDuration',
  'offlineSolves',
  'velocity',
];

function input(id: string): HTMLInputElement {
  const element = byId(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Missing input #${id}`);
  }
  return element;
}

function textarea(id: string): HTMLTextAreaElement {
  const element = byId(id);
  if (!(element instanceof HTMLTextAreaElement)) {
    throw new Error(`Missing textarea #${id}`);
  }
  return element;
}

function button(id: string): HTMLButtonElement {
  const element = byId(id);
  if (!(element instanceof HTMLButtonElement)) throw new Error(`Missing button #${id}`);
  return element;
}

/** Count whitespace-delimited move tokens while preserving editable free-form text. */
export function countDetectedMoves(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).filter((token) => !/^[·•/|]$/.test(token)).length;
}

export type MoveCategory = {
  face: string;
  isRotation: boolean;
};

export function categorizeMoveToken(token: string): MoveCategory {
  const clean = token.trim();
  if (!clean) return { face: 'unknown', isRotation: false };

  // Cube rotations around axes:
  // x / CR: rotates around R axis (Red)
  if (/^x/i.test(clean) || /^CR/i.test(clean)) {
    return { face: 'R', isRotation: true };
  }
  // y / CU: rotates around U axis (White / Slate)
  if (/^y/i.test(clean) || /^CU/i.test(clean)) {
    return { face: 'U', isRotation: true };
  }
  // z / CF: rotates around F axis (Green)
  if (/^z/i.test(clean) || /^CF/i.test(clean)) {
    return { face: 'F', isRotation: true };
  }
  // Other SiGN/SSE rotation variants:
  if (/^CL/i.test(clean)) return { face: 'L', isRotation: true };
  if (/^CD/i.test(clean)) return { face: 'D', isRotation: true };
  if (/^CB/i.test(clean)) return { face: 'B', isRotation: true };

  // Slice moves:
  if (/^M/i.test(clean)) return { face: 'M', isRotation: false };
  if (/^E/i.test(clean)) return { face: 'E', isRotation: false };
  if (/^S/i.test(clean)) return { face: 'S', isRotation: false };

  // Outer face moves (R, L, U, D, F, B, including wide moves):
  if (/[RUFLDB]/i.test(clean)) {
    const match = clean.match(/[RUFLDB]/i);
    return { face: match ? match[0].toUpperCase() : 'unknown', isRotation: false };
  }
  return { face: 'unknown', isRotation: false };
}

let scrollAttached = false;
function ensureScrollSync(movesEl: HTMLTextAreaElement, container: HTMLElement): void {
  if (scrollAttached) return;
  scrollAttached = true;
  movesEl.addEventListener('scroll', () => {
    container.scrollTop = movesEl.scrollTop;
    container.scrollLeft = movesEl.scrollLeft;
  });
}

export function syncDetectedMovesHighlight(): void {
  const container = document.getElementById('detected-moves-highlight');
  const movesEl = document.getElementById('detectedMoves');
  if (!container || !(movesEl instanceof HTMLTextAreaElement)) return;

  ensureScrollSync(movesEl, container);

  const text = movesEl.value;
  container.innerHTML = '';
  if (!text) return;

  const parts = text.split(/(\s+)/);
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      container.appendChild(document.createTextNode(part));
    } else if (/^[·•/|]$/.test(part)) {
      const sep = document.createElement('span');
      sep.className = 'move-separator';
      sep.textContent = part;
      container.appendChild(sep);
    } else {
      const span = document.createElement('span');
      span.className = 'move-token';
      const { face, isRotation } = categorizeMoveToken(part);
      span.dataset.face = face;
      if (isRotation) span.classList.add('is-rotation');
      span.textContent = part;
      container.appendChild(span);
    }
  }
  container.scrollTop = movesEl.scrollTop;
  container.scrollLeft = movesEl.scrollLeft;
}

export const syncDetectedMovesChips = syncDetectedMovesHighlight;

export function syncDetectedMoveCount(): void {
  const el = document.getElementById('moveCount');
  const movesEl = document.getElementById('detectedMoves');
  if (el && movesEl instanceof HTMLTextAreaElement) {
    el.textContent = String(countDetectedMoves(movesEl.value));
  }
  syncDetectedMovesHighlight();
}

export function setDetectedMoveCount(count: number): void {
  byId('moveCount').textContent = String(count);
  syncDetectedMovesHighlight();
}

let feedbackTimeout: number | undefined;

export function showFeedback(message: string): void {
  const feedback = byId('app-feedback');
  feedback.textContent = message;
  feedback.hidden = false;
  window.clearTimeout(feedbackTimeout);
  feedbackTimeout = window.setTimeout(() => {
    feedback.hidden = true;
  }, 3200);
}

let gripGestureTimeout: number | undefined;

export function setActiveGrip(gripName: string, gesture?: string): void {
  const value = document.getElementById('grip-value');
  if (value) value.textContent = gripName;
  const badge = document.getElementById('grip-gesture');
  if (badge) {
    if (gesture) {
      badge.textContent = gesture;
      badge.hidden = false;
      window.clearTimeout(gripGestureTimeout);
      gripGestureTimeout = window.setTimeout(() => {
        badge.hidden = true;
      }, 3000);
    } else {
      badge.hidden = true;
    }
  }
}

export function clearActiveGrip(): void {
  const value = document.getElementById('grip-value');
  if (value) value.textContent = 'Home';
  const badge = document.getElementById('grip-gesture');
  if (badge) badge.hidden = true;
  window.clearTimeout(gripGestureTimeout);
}

export function setInfo(id: string, value: string): void {
  const el = input(id);
  el.value = value;
  el.title = value;
  el.dataset.na = String(value === notAvailable);
}

export function showInfo(id: string): void {
  input(id).hidden = false;
  const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
  if (!label) throw new Error(`Missing label for #${id}`);
  label.hidden = false;
  if (id === 'cubieState') {
    const cubiePanel = document.querySelector<HTMLElement>('.cubie-state-panel');
    if (cubiePanel) cubiePanel.hidden = false;
  }
  if (
    [
      'eventSerial',
      'centerOrientation',
      'goCubeType',
      'offlineMoves',
      'offlineDuration',
      'offlineSolves',
    ].includes(id)
  ) {
    const offlineTitle = document.getElementById('info-offline-title');
    if (offlineTitle) offlineTitle.hidden = false;
  }
}

export function setTimer(value: string): void {
  byId('timer').textContent = value;
}

export function showTimer(show: boolean): void {
  byId('timer').style.display = show ? 'block' : 'none';
}

export function setTimerColor(color: string): void {
  byId('timer').style.color = color;
}

export function setConnectLabel(label: 'Connect' | 'Disconnect'): void {
  const connect = button('connect');
  const connected = label === 'Disconnect';
  const mockActive = connect.dataset.mockActive === 'true';
  connect.textContent = connected ? (mockActive ? 'Replay mode ▾' : 'Connected ▾') : 'Connect ▾';
  connect.dataset.state = connected ? 'connected' : 'connect';
  const connectBluetooth = button('connect-bluetooth');
  const disconnect = button('disconnect-cube');
  connectBluetooth.hidden = connected;
  disconnect.hidden = !connected;
}

/** The tracker is meaningful only when the connected cube publishes gyro poses. */
export function setOrientationTrackingAvailable(available: boolean): void {
  const tracker = button('track-orientation');
  tracker.disabled = !available;
  tracker.title = available
    ? 'Track the cube gyroscope in the 3D view.'
    : 'Requires a connected cube with a gyroscope.';
  if (!available) tracker.setAttribute('aria-pressed', 'false');
}

export function setOrientationTracking(tracking: boolean): void {
  button('track-orientation').setAttribute('aria-pressed', String(tracking));
  button('reset-gyro').textContent = tracking ? 'Reset gyro' : 'Reset view';
}

/** Reset is disabled only while no active scene can be controlled. */
export function setResetOrientationEnabled(enabled: boolean): void {
  const reset = button('reset-gyro');
  reset.disabled = !enabled;
  reset.title = enabled ? 'Reset the 3D view orientation.' : 'Connect a cube first.';
}

/** Starting the timer requires a connected cube to detect the first move against. */
export function setTimerActivateEnabled(enabled: boolean): void {
  const start = document.getElementById('start-timer');
  if (start instanceof HTMLButtonElement) {
    start.disabled = !enabled;
    start.title = enabled
      ? 'Arm the solving timer.'
      : 'Connect a cube or choose a replay capture first.';
  }
  const status = document.getElementById('quick-game-status');
  if (status && !enabled)
    status.textContent = 'Connect a cube or choose a replay capture to begin.';
}

export type TimerButtonState = 'idle' | 'ready' | 'running' | 'stopped';

export function setTimerButtonState(state: TimerButtonState, finalTime?: string): void {
  const btn = document.getElementById('start-timer');
  const status = document.getElementById('quick-game-status');
  if (!(btn instanceof HTMLButtonElement)) return;
  if (!(status instanceof HTMLElement)) return;
  btn.dataset.timerState = state;
  switch (state) {
    case 'idle':
      btn.textContent = 'Start game';
      status.textContent = 'Scramble the cube to any state, then start the solving timer.';
      break;
    case 'ready':
      btn.textContent = 'Ready';
      status.textContent = 'Turn any face to start the solving timer.';
      break;
    case 'running':
      btn.textContent = 'Solving…';
      status.textContent = 'Turn until solved; timing stops automatically.';
      break;
    case 'stopped':
      btn.textContent = 'Solve again';
      status.textContent = finalTime ? `Solved in ${finalTime}.` : 'Solved.';
      break;
  }
}

export function setTps(tps: number | null): void {
  const container = document.getElementById('tps-container');
  const value = document.getElementById('tpsValue');
  if (!container || !value) return;
  if (tps !== null && Number.isFinite(tps) && tps >= 0) {
    value.textContent = tps.toFixed(1);
    container.hidden = false;
  } else {
    container.hidden = true;
  }
}

export function setConnectionStatus(status: string): void {
  const connectionStatus = input('connectionStatus');
  connectionStatus.value = status;
  connectionStatus.dataset.state = status.toLowerCase().replace(/[^a-z]+/g, '-');
}

/** Append a detected move while leaving the field editable for correction/copying. */
export function appendDetectedMove(move: string): void {
  const moves = textarea('detectedMoves');
  moves.value = moves.value ? `${moves.value} ${move}` : move;
  syncDetectedMoveCount();
}

export function clearDetectedMoves(): void {
  textarea('detectedMoves').value = '';
  syncDetectedMoveCount();
}

export function simplifyDetectedMoves(simplify: (moves: string) => string): void {
  const moves = textarea('detectedMoves');
  moves.value = simplify(moves.value);
  syncDetectedMoveCount();
}

export function setDetectedMoves(moves: string): void {
  textarea('detectedMoves').value = moves;
  syncDetectedMoveCount();
}

export function getDetectedMoves(): string {
  return textarea('detectedMoves').value;
}

export async function copyDetectedMoves(): Promise<void> {
  await copyText(textarea('detectedMoves').value);
}

/** Copy detected moves through an explicitly selected notation formatter. */
export async function copyDetectedMovesAs(format: (moves: string) => string): Promise<void> {
  await copyText(format(textarea('detectedMoves').value));
}

/** Copy plain text with a legacy fallback for browsers without Clipboard API support. */
export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const fallback = document.createElement('textarea');
  fallback.value = value;
  fallback.style.position = 'fixed';
  fallback.style.opacity = '0';
  document.body.append(fallback);
  fallback.select();
  document.execCommand('copy');
  fallback.remove();
}

export function clearInfo(): void {
  document
    .querySelectorAll<HTMLInputElement>('.info input, .cubie-state-panel input')
    .forEach((element) => {
      element.value = notAvailable;
      element.title = notAvailable;
      element.dataset.na = 'true';
    });
  optionalInfoIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.hidden = true;
    const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
    if (label) label.hidden = true;
  });
  const offlineTitle = document.getElementById('info-offline-title');
  if (offlineTitle) offlineTitle.hidden = true;
  const cubiePanel = document.querySelector<HTMLElement>('.cubie-state-panel');
  if (cubiePanel) cubiePanel.hidden = true;
  clearActiveGrip();
  clearDetectedMoves();
  setTimerButtonState('idle');
  setTps(null);
}

export function mountCube(element: Node): void {
  byId('cube').append(element);
}

export function on(id: string, type: string, listener: EventListener): void {
  byId(id).addEventListener(type, listener);
}
