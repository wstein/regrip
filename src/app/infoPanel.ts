const notAvailable = '- n/a -';
const optionalInfoIds = [
  'eventSerial', 'cubieState', 'centerOrientation', 'goCubeType',
  'offlineMoves', 'offlineDuration', 'offlineSolves', 'velocity',
];

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}

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

export function setInfo(id: string, value: string): void {
  input(id).value = value;
}

export function showInfo(id: string): void {
  input(id).hidden = false;
  const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
  if (!label) throw new Error(`Missing label for #${id}`);
  label.hidden = false;
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

export function setConnectionStatus(status: string): void {
  const connectionStatus = input('connectionStatus');
  connectionStatus.value = status;
  connectionStatus.dataset.state = status.toLowerCase().replace(/[^a-z]+/g, '-');
}

export function setLogRecording(recording: boolean): void {
  button('start-log').disabled = recording;
  button('stop-log').disabled = !recording;
}

/** Append a detected move while leaving the field editable for correction/copying. */
export function appendDetectedMove(move: string): void {
  const moves = textarea('detectedMoves');
  moves.value = moves.value ? `${moves.value} ${move}` : move;
}

export function clearDetectedMoves(): void {
  textarea('detectedMoves').value = '';
}

export function setDetectedMoves(moves: string): void {
  textarea('detectedMoves').value = moves;
}

export async function copyDetectedMoves(): Promise<void> {
  const moves = textarea('detectedMoves');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(moves.value);
    return;
  }
  moves.select();
  document.execCommand('copy');
}

export function clearInfo(): void {
  document.querySelectorAll<HTMLInputElement>('.info input, .cubie-state-panel input').forEach(element => {
    element.value = notAvailable;
  });
  optionalInfoIds.forEach(id => {
    input(id).hidden = true;
    const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
    if (!label) throw new Error(`Missing label for #${id}`);
    label.hidden = true;
  });
  clearDetectedMoves();
}

export function mountCube(element: Node): void {
  byId('cube').append(element);
}

export function on(id: string, type: string, listener: EventListener): void {
  byId(id).addEventListener(type, listener);
}
