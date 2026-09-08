const notAvailable = '- n/a -';

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

export function setInfo(id: string, value: string): void {
  input(id).value = value;
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
  byId('connect').textContent = label;
}

export function setConnectionStatus(status: string): void {
  setInfo('connectionStatus', status);
}

export function clearInfo(): void {
  document.querySelectorAll<HTMLInputElement>('.info input').forEach(element => {
    element.value = notAvailable;
  });
}

export function mountCube(element: Node): void {
  byId('cube').append(element);
}

export function on(id: string, type: string, listener: EventListener): void {
  byId(id).addEventListener(type, listener);
}
