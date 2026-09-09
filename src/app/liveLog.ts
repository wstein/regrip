import type { SmartCubeSessionEvent } from '../session/smartCubeSession';

export type TraceCategory = 'MOVE' | 'EVENT' | 'STATE' | 'GYRO' | 'REGRIP' | 'TRIGGER';

const maxRows = 300;

export function describeSessionEvent(event: SmartCubeSessionEvent): [TraceCategory, string] {
  switch (event.type) {
    case 'MOVE': return ['MOVE', event.move];
    case 'GYRO': return ['GYRO', `q ${event.quaternion.x.toFixed(2)}, ${event.quaternion.y.toFixed(2)}, ${event.quaternion.z.toFixed(2)}`];
    case 'REGRIP': return ['REGRIP', `${event.notationToken} (${event.sensorFrameToken})`];
    case 'CUSTOM_TRIGGER': return ['TRIGGER', event.move];
    case 'BATTERY': return ['EVENT', `battery ${event.batteryLevel}%`];
    case 'HARDWARE': return ['EVENT', event.hardwareName ?? 'hardware'];
    case 'FACELETS': return ['EVENT', 'facelets'];
    case 'DISCONNECT': return ['STATE', 'cube disconnected'];
  }
}

function time(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString([], { hour12: false })}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

/** Always-on, bounded DOM trace. This intentionally has no JSONL dependency. */
export function createLiveLog() {
  const root = document.getElementById('event-log-rows');
  const clear = document.getElementById('clear-trace');
  if (!root || !clear) throw new Error('Missing live trace elements');
  const enabled = new Set<TraceCategory>(['MOVE', 'EVENT', 'STATE', 'REGRIP', 'TRIGGER']);

  const append = (category: TraceCategory, message: string, timestamp?: number): void => {
    if (!enabled.has(category)) return;
    const row = document.createElement('div');
    row.className = `trace-row trace-${category.toLowerCase()}`;
    row.innerHTML = `<span class="trace-badge">${category}</span><time>${time(timestamp)}</time><span class="trace-message"></span>`;
    row.querySelector<HTMLSpanElement>('.trace-message')!.textContent = message;
    root.prepend(row);
    while (root.children.length > maxRows) root.lastElementChild?.remove();
  };

  document.querySelectorAll<HTMLButtonElement>('[data-trace-filter]').forEach(button => {
    const category = button.dataset.traceFilter as TraceCategory;
    button.classList.toggle('is-active', enabled.has(category));
    button.addEventListener('click', () => {
      if (enabled.has(category)) enabled.delete(category); else enabled.add(category);
      button.classList.toggle('is-active', enabled.has(category));
      button.setAttribute('aria-pressed', String(enabled.has(category)));
    });
  });
  clear.addEventListener('click', () => { root.replaceChildren(); });

  return {
    append,
    appendSessionEvent(event: SmartCubeSessionEvent): void {
      const [category, message] = describeSessionEvent(event);
      append(category, message, 'timestamp' in event ? event.timestamp : undefined);
    },
  };
}
