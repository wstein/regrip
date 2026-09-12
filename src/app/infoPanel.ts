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
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

export function syncDetectedMoveCount(): void {
  byId('moveCount').textContent = String(countDetectedMoves(textarea('detectedMoves').value));
}

export function setDetectedMoveCount(count: number): void {
  byId('moveCount').textContent = String(count);
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
  connect.textContent = label;
  connect.dataset.state = label.toLowerCase();
}

/** The tracker is meaningful only when the connected cube publishes gyro poses. */
export function setOrientationTrackingAvailable(available: boolean): void {
  const tracker = button('track-orientation');
  tracker.disabled = !available;
  if (!available) tracker.setAttribute('aria-pressed', 'false');
}

export function setOrientationTracking(tracking: boolean): void {
  button('track-orientation').setAttribute('aria-pressed', String(tracking));
  button('reset-gyro').textContent = tracking ? 'Reset Gyro' : 'Reset View';
}

/** Reset is disabled only while no active scene can be controlled. */
export function setResetOrientationEnabled(enabled: boolean): void {
  button('reset-gyro').disabled = !enabled;
}

/** Starting the timer requires a connected cube to detect the first move against. */
export function setTimerActivateEnabled(enabled: boolean): void {
  button('start-timer').disabled = !enabled;
}

export type TimerButtonState = 'idle' | 'ready' | 'running' | 'stopped';

export function setTimerButtonState(state: TimerButtonState, finalTime?: string): void {
  const btn = document.getElementById('start-timer');
  if (!(btn instanceof HTMLButtonElement)) return;
  btn.dataset.timerState = state;
  switch (state) {
    case 'idle':
      btn.textContent =
        'Scramble cube to arbitrary state, then press here to start the solving timer...';
      break;
    case 'ready':
      btn.textContent = '⚡ Ready: Turn any face to start solving timer...';
      break;
    case 'running':
      btn.textContent = '⏱ Solving in progress... (turn until solved)';
      break;
    case 'stopped':
      btn.textContent = finalTime
        ? `🎉 Solved in ${finalTime}! Press here to solve again...`
        : '🎉 Solved! Press here to solve again...';
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
