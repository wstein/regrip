import { computed, signal } from '@preact/signals-core';

import type { SmartCubeSessionEvent } from '@wstein/regrip-core/session/smartCubeSession';
import { byId } from './dom';
import { downloadJsonl, serializeJsonl, type JsonValue, type LogEntry } from './jsonlLog';

export type TraceCategory = 'MOVE' | 'EVENT' | 'STATE' | 'GYRO' | 'REGRIP' | 'TRIGGER' | 'SHAKE';

export type TraceEntry = {
  id: number;
  category: TraceCategory;
  message: string;
  log: LogEntry;
};

type LiveLogOptions = {
  onReproduceMoves?: (moves: string[]) => void;
  onClear?: () => void;
  onFocusEntry?: (entry: TraceEntry) => void;
  now?: () => Date;
};

const maxRows = 300;

export function describeSessionEvent(event: SmartCubeSessionEvent): [TraceCategory, string] {
  switch (event.type) {
    case 'MOVE':
      return ['MOVE', event.move];
    case 'GYRO':
      return [
        'GYRO',
        `q ${event.quaternion.x.toFixed(2)}, ${event.quaternion.y.toFixed(2)}, ${event.quaternion.z.toFixed(2)}`,
      ];
    case 'REGRIP':
      return ['REGRIP', `${event.notationToken} (${event.sensorFrameToken})`];
    case 'CUSTOM_TRIGGER':
      return ['TRIGGER', event.move];
    case 'SHAKE':
      return ['SHAKE', `${event.steps} steps, ${event.reversals} reversals`];
    case 'BATTERY':
      return ['EVENT', `battery ${event.batteryLevel}%`];
    case 'HARDWARE':
      return ['EVENT', event.hardwareName ?? 'hardware'];
    case 'FACELETS':
      return ['EVENT', 'facelets'];
    case 'DISCONNECT':
      return ['STATE', 'cube disconnected'];
  }
}

export function describeLogEntry(entry: LogEntry): [TraceCategory, string] {
  const data = entry.data as Record<string, unknown>;
  if (entry.type === 'cube_event') {
    const eventType = data.type;
    if (eventType === 'MOVE' && typeof data.move === 'string') return ['MOVE', data.move];
    if (eventType === 'DISCONNECT') return ['STATE', 'cube disconnected'];
    if (eventType === 'BATTERY' && typeof data.batteryLevel === 'number')
      return ['EVENT', `battery ${data.batteryLevel}%`];
    if (eventType === 'HARDWARE')
      return ['EVENT', typeof data.hardwareName === 'string' ? data.hardwareName : 'hardware'];
    return ['EVENT', typeof eventType === 'string' ? eventType.toLowerCase() : 'cube event'];
  }
  if (entry.type === 'virtual_regrip') {
    return ['REGRIP', `${String(data.notationToken)} (${String(data.sensorFrameToken)})`];
  }
  if (entry.type === 'custom_trigger') return ['TRIGGER', String(data.move)];
  if (entry.type === 'shake_trigger')
    return ['SHAKE', `${String(data.steps)} steps, ${String(data.reversals)} reversals`];
  if (entry.type === 'gyro_stabilizer') return ['GYRO', 'stabilized gyro'];
  if (entry.type === 'session_status') return ['STATE', String(data.status)];
  if (entry.type === 'log_started') return ['STATE', 'recording started'];
  if (entry.type === 'log_stopped')
    return ['STATE', `recording stopped · ${String(data.entries)} events`];
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

/** Always-on, bounded trace with local selection and export affordances. */
export function createLiveLog({
  onReproduceMoves,
  onClear,
  onFocusEntry,
  now = () => new Date(),
}: LiveLogOptions = {}) {
  const root = byId('event-log-rows');
  const clear = byId('clear-trace');
  const sort = byId('sort-trace');
  const follow = byId<HTMLButtonElement>('follow-trace');
  const selection = byId('trace-selection');
  const selectionCount = byId('trace-selection-count');
  const selectAll = byId('select-all-trace');
  const exportButton = byId('export-trace');
  const copyButton = byId('copy-trace');
  const reproduceButton = byId<HTMLButtonElement>('reproduce-trace');
  const clearSelection = byId('clear-trace-selection');
  const detail = byId('trace-detail');
  const detailSummary = byId('trace-detail-summary');
  const detailJson = byId('trace-detail-json');
  const copyDetail = byId('copy-trace-detail');
  const contextMenu = byId('trace-context-menu');
  const selectContextEvent = byId('select-trace-event');
  const copyContextEvent = byId('copy-trace-event');
  const exportContextEvent = byId('export-trace-event');

  const activeFilters = signal<ReadonlySet<TraceCategory>>(
    new Set(['MOVE', 'EVENT', 'STATE', 'REGRIP', 'TRIGGER', 'SHAKE']),
  );
  const entries = signal<TraceEntry[]>([]);
  const visibleEntries = computed(() =>
    entries.value.filter((entry) => activeFilters.value.has(entry.category)),
  );
  const selected = new Set<number>();
  let newestFirst = true;
  let autoFollow = true;
  let nextId = 1;
  let lastSelectedId: number | undefined;
  let focusedId: number | undefined;
  let contextId: number | undefined;

  const selectedEntries = (): TraceEntry[] =>
    entries.value.filter((entry) => selected.has(entry.id));
  const selectedMoves = (): string[] =>
    selectedEntries()
      .filter((entry) => entry.category === 'MOVE')
      .map((entry) => entry.message);

  const followEdge = (): number => (newestFirst ? 0 : root.scrollHeight);
  const isAtFollowEdge = (): boolean => {
    const tolerance = 2;
    return newestFirst
      ? root.scrollTop <= tolerance
      : root.scrollTop + root.clientHeight >= root.scrollHeight - tolerance;
  };
  const updateFollowButton = (): void => {
    follow.toggleAttribute('disabled', autoFollow);
    follow.textContent = autoFollow ? 'Following newest' : 'Newest';
  };

  const updateSelection = (): void => {
    const count = selected.size;
    selection.hidden = count === 0;
    selectionCount.textContent = `${count} selected`;
    reproduceButton.toggleAttribute('disabled', selectedMoves().length === 0);
  };

  const entryById = (id: number | undefined): TraceEntry | undefined =>
    entries.value.find((entry) => entry.id === id);

  const serializeEntry = (entry: TraceEntry): string => serializeJsonl([entry.log]);

  const copyEntry = (entry: TraceEntry): void => {
    void navigator.clipboard?.writeText(serializeEntry(entry));
  };

  const exportEntry = (entry: TraceEntry): void => {
    downloadJsonl(
      serializeEntry(entry),
      `smartcube-trace-event-${entry.id}-${now().toISOString().replace(/:/g, '-')}.jsonl`,
    );
  };

  const updateDetail = (): void => {
    const entry = entryById(focusedId);
    detail.hidden = !entry;
    if (!entry) return;
    detailSummary.textContent = `${entry.category} · ${displayTime(Date.parse(entry.log.recordedAt))}`;
    detailJson.textContent = JSON.stringify(entry.log, null, 2);
  };

  const hideContextMenu = (): void => {
    contextMenu.hidden = true;
    contextId = undefined;
  };

  const selectEntry = (id: number, range: boolean): void => {
    if (range && lastSelectedId !== undefined) {
      const start = entries.value.findIndex((entry) => entry.id === lastSelectedId);
      const end = entries.value.findIndex((entry) => entry.id === id);
      if (start !== -1 && end !== -1) {
        const [from, to] = start < end ? [start, end] : [end, start];
        entries.value.slice(from, to + 1).forEach((entry) => selected.add(entry.id));
      }
    } else if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    lastSelectedId = id;
    render();
  };

  const render = (): void => {
    const previousScrollTop = root.scrollTop;
    const ordered = newestFirst ? [...visibleEntries.value].reverse() : visibleEntries.value;
    root.replaceChildren(
      ...ordered.map((entry) => {
        const row = document.createElement('article');
        const isSelected = selected.has(entry.id);
        row.className = `trace-row trace-${entry.category.toLowerCase()}`;
        row.dataset.traceId = String(entry.id);
        row.tabIndex = 0;
        row.classList.toggle('is-selected', isSelected);
        row.classList.toggle('is-focused', focusedId === entry.id);
        row.setAttribute('aria-selected', String(isSelected));

        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'trace-badge';
        badge.textContent = `${isSelected ? '✓ ' : ''}${entry.category}`;
        badge.title = `Select all ${entry.category} events`;
        badge.addEventListener('click', (event) => {
          event.stopPropagation();
          entries.value
            .filter((candidate) => candidate.category === entry.category)
            .forEach((candidate) => selected.add(candidate.id));
          lastSelectedId = entry.id;
          render();
        });

        const timestamp = document.createElement('time');
        timestamp.textContent = displayTime(Date.parse(entry.log.recordedAt));
        const message = document.createElement('span');
        message.className = 'trace-message';
        message.textContent = entry.message;
        row.append(badge, timestamp, message);
        const focusDetails = (): void => {
          focusedId = entry.id;
          onFocusEntry?.(entry);
          updateDetail();
          render();
        };
        row.addEventListener('click', (event) => {
          if ((event as MouseEvent).shiftKey) selectEntry(entry.id, true);
          else focusDetails();
        });
        row.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (event.shiftKey) selectEntry(entry.id, true);
            else focusDetails();
          }
        });
        row.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          contextId = entry.id;
          contextMenu.hidden = false;
          contextMenu.style.left = `${event.clientX}px`;
          contextMenu.style.top = `${event.clientY}px`;
        });
        return row;
      }),
    );
    updateSelection();
    updateDetail();
    root.scrollTop = autoFollow ? followEdge() : previousScrollTop;
  };

  const appendEntry = (category: TraceCategory, message: string, log: LogEntry): void => {
    const nextEntries = [
      ...entries.value,
      {
        id: nextId++,
        category,
        message,
        log,
      },
    ];
    while (nextEntries.length > maxRows) {
      const removed = nextEntries.shift()!;
      selected.delete(removed.id);
      if (focusedId === removed.id) focusedId = undefined;
    }
    entries.value = nextEntries;
    render();
  };

  const append = (
    category: TraceCategory,
    message: string,
    timestamp = now().getTime(),
    data: JsonValue = { message },
  ): void => {
    appendEntry(category, message, {
      recordedAt: new Date(timestamp).toISOString(),
      type: category.toLowerCase(),
      data,
    });
  };

  document.querySelectorAll<HTMLButtonElement>('[data-trace-filter]').forEach((button) => {
    const category = button.dataset.traceFilter as TraceCategory;
    button.classList.toggle('is-active', activeFilters.value.has(category));
    button.addEventListener('click', () => {
      const next = new Set(activeFilters.value);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      activeFilters.value = next;
      button.classList.toggle('is-active', next.has(category));
      button.setAttribute('aria-pressed', String(next.has(category)));
      render();
    });
  });
  clear.addEventListener('click', () => {
    entries.value = [];
    selected.clear();
    lastSelectedId = undefined;
    focusedId = undefined;
    hideContextMenu();
    render();
    onClear?.();
  });
  sort.addEventListener('click', () => {
    newestFirst = !newestFirst;
    sort.textContent = newestFirst ? '↓ Newest' : '↑ Oldest';
    sort.setAttribute('aria-label', newestFirst ? 'Sort newest first' : 'Sort oldest first');
    sort.setAttribute('title', newestFirst ? 'Sort newest first' : 'Sort oldest first');
    render();
    autoFollow = true;
    root.scrollTop = followEdge();
    updateFollowButton();
  });
  follow.addEventListener('click', () => {
    autoFollow = true;
    root.scrollTop = followEdge();
    updateFollowButton();
  });
  root.addEventListener('scroll', () => {
    const nextAutoFollow = isAtFollowEdge();
    if (nextAutoFollow === autoFollow) return;
    autoFollow = nextAutoFollow;
    updateFollowButton();
  });
  selectAll.addEventListener('click', () => {
    visibleEntries.value.forEach((entry) => selected.add(entry.id));
    render();
  });
  clearSelection.addEventListener('click', () => {
    selected.clear();
    lastSelectedId = undefined;
    render();
  });
  exportButton.addEventListener('click', () => {
    const contents = serializeJsonl(selectedEntries().map((entry) => entry.log));
    if (contents)
      downloadJsonl(contents, `smartcube-trace-${now().toISOString().replace(/:/g, '-')}.jsonl`);
  });
  copyButton.addEventListener('click', () => {
    const contents = serializeJsonl(selectedEntries().map((entry) => entry.log));
    if (contents) void navigator.clipboard?.writeText(contents);
  });
  reproduceButton.addEventListener('click', () => onReproduceMoves?.(selectedMoves()));
  copyDetail.addEventListener('click', () => {
    const entry = entryById(focusedId);
    if (entry) copyEntry(entry);
  });
  selectContextEvent.addEventListener('click', () => {
    if (contextId !== undefined) selectEntry(contextId, false);
    hideContextMenu();
  });
  copyContextEvent.addEventListener('click', () => {
    const entry = entryById(contextId);
    if (entry) copyEntry(entry);
    hideContextMenu();
  });
  exportContextEvent.addEventListener('click', () => {
    const entry = entryById(contextId);
    if (entry) exportEntry(entry);
    hideContextMenu();
  });
  document.addEventListener('click', (event) => {
    if (!contextMenu.hidden && !contextMenu.contains(event.target as Node)) hideContextMenu();
  });
  updateFollowButton();

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
    getEntries: (): readonly TraceEntry[] => entries.value,
    getVisibleEntries: (): readonly TraceEntry[] => visibleEntries.value,
    getSelectedEntries: (): TraceEntry[] => selectedEntries(),
  };
}
