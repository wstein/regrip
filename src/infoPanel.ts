const notAvailable = '- n/a -';

function input(id: string): HTMLInputElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Missing input #${id}`);
  }
  return element;
}

export function setInfo(id: string, value: string): void {
  input(id).value = value;
}

export function setTimer(value: string): void {
  document.getElementById('timer')!.textContent = value;
}

export function showTimer(show: boolean): void {
  document.getElementById('timer')!.style.display = show ? '' : 'none';
}

export function setTimerColor(color: string): void {
  document.getElementById('timer')!.style.color = color;
}

export function setConnectLabel(label: 'Connect' | 'Disconnect'): void {
  document.getElementById('connect')!.textContent = label;
}

export function clearInfo(): void {
  document.querySelectorAll<HTMLInputElement>('.info input').forEach(element => {
    element.value = notAvailable;
  });
}

export function mountCube(element: Node): void {
  document.getElementById('cube')!.append(element);
}

export function on(id: string, type: string, listener: EventListener): void {
  document.getElementById(id)!.addEventListener(type, listener);
}
