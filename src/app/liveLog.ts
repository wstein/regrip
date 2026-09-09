import type { SmartCubeSessionEvent } from '../session/smartCubeSession';
import { downloadJsonl, serializeJsonl, type JsonValue, type LogEntry } from './jsonlLog';

export type TraceCategory = 'MOVE' | 'EVENT' | 'STATE' | 'GYRO' | 'REGRIP' | 'TRIGGER';

export type TraceEntry = {
  id: number;
  category: TraceCategory;
  message: string;
  log: LogEntry;
};

type LiveLogOptions = {
  onReproduceMoves?: (moves: string[]) => void;
  now?: () => Date;
};

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

export function describeLogEntry(entry: LogEntry): [TraceCategory, string] {
  const data = entry.data as Record<string, unknown>;
  if (entry.type === 'cube_event') {
    const eventType = data.type;
    if (eventType === 'MOVE' && typeof data.move === 'string') return ['MOVE', data.move];
    if (eventType === 'DISCONNECT') return ['STATE', 'cube disconnected'];
    if (eventType === 'BATTERY' && typeof data.batteryLevel === 'number') return ['EVENT', `battery ${data.batteryLevel}%`];
    if (eventType === 'HARDWARE') return ['EVENT', typeof data.hardwareName === 'string' ? data.hardwareName : 'hardware'];
    return ['EVENT', typeof eventType === 'string' ? eventType.toLowerCase() : 'cube event'];
  }
  if (entry.type === 'virtual_regrip') {
    return ['REGRIP', `${String(data.notationToken)} (${String(data.sensorFrameToken)})`];
  }
  if (entry.type === 'custom_trigger') return ['TRIGGER', String(data.move)];
  if (entry.type === 'gyro_stabilizer') return ['GYRO', 'stabilized gyro'];
  if (entry.type === 'session_status') return ['STATE', String(data.status)];
  if (entry.type === 'log_started') return ['STATE', 'recording started'];
  if (entry.type === 'log_stopped') return ['STATE', `recording stopped · ${String(data.entries)} events`];
  if (entry.type === 'profile_selected') return ['EVENT', `profile ${String(data.id)}`];
  return ['EVENT', entry.type.replace(/_/g, ' ')];
}

function displayTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString([], { hour12: false })}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

function eventTimestamp(event: SmartCubeSessionEvent): number {
  return 'timestamp' in event ? event.timestamp : Date.now();
}

/** Always-on, bounded trace. Download recording remains a separate, opt-in concern. */
export function createLiveLog({ onReproduceMoves, now = () => new Date() }: LiveLogOptions = {}) {
  const root = document.getElementById('event-log-rows');
  const clear = document.getElementById('clear-trace');
  const sort = document.getElementById('sort-trace');
  const selection = document.getElementById('trace-selection');
  const selectionCount = document.getElementById('trace-selection-count');
  const selectAll = document.getElementById('select-all-trace');
  const exportButton = document.getElementById('export-trace');
  const copyButton = document.getElementById('copy-trace');
  const reproduceButton = document.getElementById('reproduce-trace');
  const clearSelection = document.getElementById('clear-trace-selection');
  if (!root || !clear || !sort || !selection || !selectionCount || !selectAll || !exportButton || !copyButton || !reproduceButton || !clearSelection) {
    throw new Error('Missing live trace elements');
  }

  const enabled = new Set<TraceCategory>(['MOVE', 'EVENT', 'STATE', 'REGRIP', 'TRIGGER']);
  const entries: TraceEntry[] = [];
  const selected = new Set<number>();
  let newestFirst = true;
  let nextId = 1;
  let lastSelectedId: number | undefined;

  const selectedEntries = (): TraceEntry[] => entries.filter(entry => selected.has(entry.id));
  const selectedMoves = (): string[] => selectedEntries()
    .filter(entry => entry.category === 'MOVE')
    .map(entry => entry.message);

  const updateSelection = (): void => {
    const count = selected.size;
    selection.hidden = count === 0;
    selectionCount.textContent = `${count} selected`;
    reproduceButton.toggleAttribute('disabled', selectedMoves().length === 0);
  };

  const selectEntry = (id: number, range: boolean): void => {
    if (range && lastSelectedId !== undefined) {
      const start = entries.findIndex(entry => entry.id === lastSelectedId);
      const end = entries.findIndex(entry => entry.id === id);
      if (start !== -1 && end !== -1) {
        const [from, to] = start < end ? [start, end] : [end, start];
        entries.slice(from, to + 1).forEach(entry => selected.add(entry.id));
      }
    } else if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    lastSelectedId = id;
    render();
  };

  const render = (): void => {
    const ordered = newestFirst ? [...entries].reverse() : entries;
    root.replaceChildren(...ordered.map(entry => {
      const row = document.createElement('article');
      row.className = `trace-row trace-${entry.category.toLowerCase()}`;
      row.dataset.traceId = String(entry.id);
      row.tabIndex = 0;
      row.setAttribute('aria-expanded', 'false');

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'trace-select';
      check.checked = selected.has(entry.id);
      check.setAttribute('aria-label', `Select ${entry.category} event`);
      check.addEventListener('click', event => {
        event.stopPropagation();
        selectEntry(entry.id, (event as MouseEvent).shiftKey);
      });

      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'trace-badge';
      badge.textContent = entry.category;
      badge.title = `Select all ${entry.category} events`;
      badge.addEventListener('click', event => {
        event.stopPropagation();
        entries.filter(candidate => candidate.category === entry.category).forEach(candidate => selected.add(candidate.id));
        lastSelectedId = entry.id;
        render();
      });

      const timestamp = document.createElement('time');
      timestamp.textContent = displayTime(Date.parse(entry.log.recordedAt));
      const message = document.createElement('span');
      message.className = 'trace-message';
      message.textContent = entry.message;
      const details = document.createElement('pre');
      details.className = 'trace-details';
      details.hidden = true;
      details.textContent = JSON.stringify(entry.log, null, 2);

      row.append(check, badge, timestamp, message, details);
      const toggleDetails = (): void => {
        details.hidden = !details.hidden;
        row.setAttribute('aria-expanded', String(!details.hidden));
      };
      row.addEventListener('click', toggleDetails);
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleDetails(); }
      });
      return row;
    }));
    updateSelection();
  };

  const appendEntry = (category: TraceCategory, message: string, log: LogEntry): void => {
    if (!enabled.has(category)) return;
    entries.push({
      id: nextId++, category, message, log,
    });
    while (entries.length > maxRows) {
      const removed = entries.shift()!;
      selected.delete(removed.id);
    }
    render();
    root.scrollTop = newestFirst ? 0 : root.scrollHeight;
  };

  const append = (category: TraceCategory, message: string, timestamp = now().getTime(), data: JsonValue = { message }): void => {
    appendEntry(category, message, { recordedAt: new Date(timestamp).toISOString(), type: category.toLowerCase(), data });
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
  clear.addEventListener('click', () => { entries.splice(0); selected.clear(); lastSelectedId = undefined; render(); });
  sort.addEventListener('click', () => {
    newestFirst = !newestFirst;
    sort.textContent = newestFirst ? '↓ Newest' : '↑ Oldest';
    sort.setAttribute('aria-label', newestFirst ? 'Sort newest first' : 'Sort oldest first');
    sort.setAttribute('title', newestFirst ? 'Sort newest first' : 'Sort oldest first');
    render();
    root.scrollTop = newestFirst ? 0 : root.scrollHeight;
  });
  selectAll.addEventListener('click', () => { entries.forEach(entry => selected.add(entry.id)); render(); });
  clearSelection.addEventListener('click', () => { selected.clear(); lastSelectedId = undefined; render(); });
  exportButton.addEventListener('click', () => {
    const contents = serializeJsonl(selectedEntries().map(entry => entry.log));
    if (contents) downloadJsonl(contents, `smartcube-trace-${now().toISOString().replace(/:/g, '-')}.jsonl`);
  });
  copyButton.addEventListener('click', () => {
    const contents = serializeJsonl(selectedEntries().map(entry => entry.log));
    if (contents) void navigator.clipboard?.writeText(contents);
  });
  reproduceButton.addEventListener('click', () => onReproduceMoves?.(selectedMoves()));

  return {
    append,
    appendSessionEvent(event: SmartCubeSessionEvent): void {
      const [category, message] = describeSessionEvent(event);
      append(category, message, eventTimestamp(event), event as unknown as JsonValue);
    },
    appendLogEntry(entry: LogEntry): void {
      const [category, message] = describeLogEntry(entry);
      appendEntry(category, message, entry);
    },
    getEntries: (): readonly TraceEntry[] => entries,
    getSelectedEntries: (): TraceEntry[] => selectedEntries(),
  };
}
