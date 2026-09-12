import { computed, signal } from '@preact/signals-core';

import type {
  SmartCubeSessionDiagnostic,
  SmartCubeSessionEvent,
} from '@wstein/regrip-core/session/smartCubeSession';
import { byId, createDropdownMenu } from './dom';
import { downloadJsonl, serializeJsonl, type JsonValue, type LogEntry } from './jsonlLog';

export type TraceCategory =
  | 'MOVE'
  | 'EVENT'
  | 'STATE'
  | 'COMMAND'
  | 'UNKNOWN'
  | 'DIAGNOSTIC'
  | 'GYRO'
  | 'REGRIP'
  | 'TRIGGER'
  | 'SHAKE';

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
  /** Coalesces incoming trace updates; defaults to one render per animation frame. */
  scheduleRender?: (render: () => void) => void;
};

const maxBufferedEntries = 10_000;
/** Raw packets are debug evidence, never allowed to evict state evidence. */
const maxBufferedDiagnostics = 512;
const maxDiagnosticBytes = 512;
const maxVisibleRows = 300;

function hardwareSummary(data: Record<string, unknown>): string {
  const name = typeof data.hardwareName === 'string' ? data.hardwareName : 'hardware';
  const details = [
    typeof data.hardwareVersion === 'string' ? `HW ${data.hardwareVersion}` : undefined,
    typeof data.softwareVersion === 'string' ? `SW ${data.softwareVersion}` : undefined,
  ].filter((value): value is string => value !== undefined);
  return details.length > 0 ? `${name} · ${details.join(' · ')}` : name;
}

function faceletsSummary(data: Record<string, unknown>): string {
  const serial = typeof data.serial === 'number' ? ` #${data.serial}` : '';
  const stickers = typeof data.facelets === 'string' ? ` · ${data.facelets.length} stickers` : '';
  return `facelets${serial}${stickers}`;
}

function hexBytes(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

export function highlightJson(jsonString: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const tokenRegex =
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[{}[\],:]|[^\s{}[\],:]+|\s+)/g;

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(jsonString)) !== null) {
    const token = match[0];
    if (!token) continue;

    if (token.startsWith('"')) {
      if (token.endsWith(':')) {
        const colonIndex = token.lastIndexOf(':');
        const keyPart = token.slice(0, colonIndex).trimEnd();
        const punctPart = token.slice(keyPart.length);
        const keySpan = document.createElement('span');
        keySpan.className = 'json-key';
        keySpan.textContent = keyPart;
        fragment.appendChild(keySpan);

        const colonSpan = document.createElement('span');
        colonSpan.className = 'json-punct';
        colonSpan.textContent = punctPart;
        fragment.appendChild(colonSpan);
      } else {
        const strSpan = document.createElement('span');
        strSpan.className = 'json-string';
        strSpan.textContent = token;
        fragment.appendChild(strSpan);
      }
    } else if (token === 'true' || token === 'false') {
      const boolSpan = document.createElement('span');
      boolSpan.className = 'json-boolean';
      boolSpan.textContent = token;
      fragment.appendChild(boolSpan);
    } else if (token === 'null') {
      const nullSpan = document.createElement('span');
      nullSpan.className = 'json-null';
      nullSpan.textContent = token;
      fragment.appendChild(nullSpan);
    } else if (/^-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?$/.test(token)) {
      const numSpan = document.createElement('span');
      numSpan.className = 'json-number';
      numSpan.textContent = token;
      fragment.appendChild(numSpan);
    } else if (/^[{}[\],:]$/.test(token)) {
      const punctSpan = document.createElement('span');
      punctSpan.className = 'json-punct';
      punctSpan.textContent = token;
      fragment.appendChild(punctSpan);
    } else {
      fragment.appendChild(document.createTextNode(token));
    }
  }
  return fragment;
}

export function extractTraceChips(entry: TraceEntry): Array<{ label: string; value: string }> {
  const chips: Array<{ label: string; value: string }> = [];
  const data = (entry.log.data as Record<string, unknown> | undefined) ?? {};

  if (entry.category === 'MOVE') {
    const move = typeof data.move === 'string' ? data.move : entry.message;
    chips.push({ label: 'Move', value: move });
    if (typeof data.face === 'string') {
      chips.push({ label: 'Face', value: data.face });
    }
    if (typeof data.turns === 'number') {
      chips.push({ label: 'Turns', value: String(data.turns) });
    }
    if (typeof data.amount === 'number') {
      chips.push({ label: 'Amount', value: String(data.amount) });
    }
  } else if (entry.category === 'STATE') {
    const stateVal =
      typeof data.status === 'string'
        ? data.status
        : typeof data.state === 'string'
          ? data.state
          : entry.message;
    chips.push({ label: 'State', value: stateVal });
    if (typeof data.profile === 'string') {
      chips.push({ label: 'Profile', value: data.profile });
    }
  } else if (entry.category === 'REGRIP') {
    const solverToken =
      typeof data.solverToken === 'string'
        ? data.solverToken
        : typeof data.notationToken === 'string'
          ? data.notationToken
          : entry.message;
    chips.push({ label: 'Regrip', value: solverToken });
    if (typeof data.sensorFrameToken === 'string') {
      chips.push({ label: 'Sensor', value: data.sensorFrameToken });
    }
  } else if (entry.category === 'TRIGGER') {
    chips.push({
      label: 'Trigger',
      value: typeof data.move === 'string' ? data.move : entry.message,
    });
  } else if (entry.category === 'SHAKE') {
    chips.push({ label: 'Gesture', value: 'Shake' });
    if (typeof data.steps === 'number') chips.push({ label: 'Steps', value: String(data.steps) });
    if (typeof data.reversals === 'number')
      chips.push({ label: 'Reversals', value: String(data.reversals) });
  } else if (entry.category === 'COMMAND') {
    if (typeof data.name === 'string') chips.push({ label: 'Command', value: data.name });
    if (typeof data.status === 'string') chips.push({ label: 'Status', value: data.status });
  }

  if (typeof data.batteryLevel === 'number') {
    chips.push({ label: 'Battery', value: `${data.batteryLevel}%` });
  } else if (typeof data.battery === 'number') {
    chips.push({ label: 'Battery', value: `${data.battery}%` });
  }

  if (typeof data.hardwareName === 'string') {
    chips.push({ label: 'Hardware', value: data.hardwareName });
  }

  if (Array.isArray(data.facelets)) {
    chips.push({ label: 'Facelets', value: `${data.facelets.length} stickers` });
  } else if (typeof data.facelets === 'string') {
    chips.push({ label: 'Facelets', value: `${data.facelets.length} stickers` });
  }

  if (data.quaternion && typeof data.quaternion === 'object') {
    const q = data.quaternion as Record<string, number>;
    if (typeof q.x === 'number' && typeof q.y === 'number') {
      chips.push({
        label: 'Quat',
        value: `[${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(2)}]`,
      });
    }
  }

  if (typeof data.opcode === 'number') {
    chips.push({ label: 'Opcode', value: `0x${data.opcode.toString(16).padStart(2, '0')}` });
  }
  if (Array.isArray(data.bytes)) {
    chips.push({ label: 'Payload', value: `${data.bytes.length} B` });
  }

  return chips;
}

export function describeDiagnostic(event: SmartCubeSessionDiagnostic): string {
  const opcode = event.opcode === undefined ? '' : ` opcode 0x${event.opcode.toString(16)}`;
  return `${event.protocol}${opcode} · ${event.bytes.length} bytes · ${hexBytes(event.bytes)}`;
}

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
    case 'MOVE_GAP':
      return ['STATE', `${event.missing} missed move${event.missing === 1 ? '' : 's'}`];
    case 'BATTERY':
      return ['EVENT', `battery ${event.batteryLevel}%`];
    case 'HARDWARE':
      return ['EVENT', hardwareSummary(event)];
    case 'FACELETS':
      return ['EVENT', faceletsSummary(event)];
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
    if (eventType === 'HARDWARE') return ['EVENT', hardwareSummary(data)];
    if (eventType === 'FACELETS') return ['EVENT', faceletsSummary(data)];
    return [
      'UNKNOWN',
      typeof eventType === 'string' ? `unknown event · ${eventType}` : 'unknown cube event',
    ];
  }
  if (entry.type === 'virtual_regrip') {
    const solverToken =
      typeof data.solverToken === 'string' ? data.solverToken : data.notationToken;
    return ['REGRIP', `${String(solverToken)} (${String(data.sensorFrameToken)})`];
  }
  if (entry.type === 'custom_trigger') return ['TRIGGER', String(data.move)];
  if (entry.type === 'shake_trigger')
    return ['SHAKE', `${String(data.steps)} steps, ${String(data.reversals)} reversals`];
  if (entry.type === 'move_gap')
    return ['STATE', `${String(data.missing)} missed move${data.missing === 1 ? '' : 's'}`];
  if (entry.type === 'gyro_stabilizer') return ['GYRO', 'stabilized gyro'];
  if (entry.type === 'session_status') return ['STATE', String(data.status)];
  if (entry.type === 'log_started') return ['STATE', 'recording started'];
  if (entry.type === 'log_stopped')
    return ['STATE', `recording stopped · ${String(data.entries)} events`];
  if (entry.type === 'profile_selected') return ['EVENT', `profile ${String(data.id)}`];
  if (entry.type === 'cube_command') {
    const name = typeof data.name === 'string' ? data.name : 'cube command';
    const status = typeof data.status === 'string' ? ` · ${data.status}` : '';
    const reason = typeof data.reason === 'string' ? ` · ${data.reason.replace(/_/g, ' ')}` : '';
    return ['COMMAND', `${name}${status}${reason}`];
  }
  if (entry.type === 'transport_diagnostic') {
    const protocol = typeof data.protocol === 'string' ? data.protocol : 'transport';
    const opcode = typeof data.opcode === 'number' ? ` opcode 0x${data.opcode.toString(16)}` : '';
    const bytes = Array.isArray(data.bytes)
      ? data.bytes.filter((byte): byte is number => typeof byte === 'number')
      : [];
    const originalLength = typeof data.byteLength === 'number' ? data.byteLength : bytes.length;
    const suffix = data.truncated === true ? ' (truncated)' : '';
    return [
      'DIAGNOSTIC',
      `${protocol}${opcode} · ${originalLength} bytes · ${hexBytes(bytes)}${suffix}`,
    ];
  }
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
  scheduleRender,
}: LiveLogOptions = {}) {
  const root = byId('event-log-rows');
  const stats = byId('trace-stats');
  const clear = byId('clear-trace');
  const sort = byId('sort-trace');
  const follow = byId<HTMLButtonElement>('follow-trace');
  const pause = byId<HTMLButtonElement>('pause-trace');
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
  const detailBadge = document.getElementById('trace-detail-badge');
  const detailTime = document.getElementById('trace-detail-time');
  const detailChips = document.getElementById('trace-detail-chips');
  const closeDetail = document.getElementById('close-trace-detail');
  const contextMenu = byId('trace-context-menu');
  const selectContextEvent = byId('select-trace-event');
  const copyContextEvent = byId('copy-trace-event');
  const exportContextEvent = byId('export-trace-event');
  const eventLog = document.getElementById('event-log');
  const appLayout = document.querySelector('.app-layout');
  const toggleCollapse = document.getElementById(
    'toggle-trace-collapse',
  ) as HTMLButtonElement | null;
  const collapsedRail = document.getElementById('trace-collapsed-rail');
  const expandCollapse = document.getElementById(
    'expand-trace-collapse',
  ) as HTMLButtonElement | null;
  const collapsedBadge = document.getElementById('trace-collapsed-badge');

  let collapsed = false;

  const setCollapsed = (next: boolean): void => {
    collapsed = next;
    if (eventLog) {
      eventLog.dataset.collapsed = String(collapsed);
    }
    if (appLayout) {
      appLayout.classList.toggle('trace-collapsed', collapsed);
    }
    if (toggleCollapse) {
      toggleCollapse.setAttribute('aria-expanded', String(!collapsed));
      toggleCollapse.textContent = collapsed ? '▶' : '◀';
      toggleCollapse.setAttribute(
        'aria-label',
        collapsed ? 'Expand live trace sidebar' : 'Collapse live trace sidebar',
      );
      toggleCollapse.setAttribute(
        'title',
        collapsed ? 'Expand trace (focus mode)' : 'Collapse trace (focus mode)',
      );
    }
    if (collapsedRail) {
      collapsedRail.hidden = !collapsed;
    }
  };

  toggleCollapse?.addEventListener('click', () => setCollapsed(!collapsed));
  expandCollapse?.addEventListener('click', () => setCollapsed(false));
  collapsedRail?.addEventListener('click', (e) => {
    if (e.target !== expandCollapse) setCollapsed(false);
  });

  const groupContainers = document.querySelectorAll<HTMLElement>(
    '.trace-heading-actions, .trace-filters',
  );

  const updateWrappedGroupSeparators = (container: HTMLElement): void => {
    const groups = Array.from(
      container.querySelectorAll<HTMLElement>('.trace-action-group, .trace-filter-group'),
    );
    groups.forEach((group, index) => {
      const previous = groups[index - 1];
      group.classList.toggle(
        'is-wrapped',
        previous !== undefined && group.offsetTop > previous.offsetTop,
      );
    });
  };
  const updateAllWrappedGroupSeparators = (): void => {
    groupContainers.forEach(updateWrappedGroupSeparators);
  };
  updateAllWrappedGroupSeparators();
  if (typeof ResizeObserver !== 'undefined') {
    const groupResizeObserver = new ResizeObserver(updateAllWrappedGroupSeparators);
    groupContainers.forEach((container) => groupResizeObserver.observe(container));
  }

  const activeFilters = signal<ReadonlySet<TraceCategory>>(
    new Set(['MOVE', 'EVENT', 'STATE', 'COMMAND', 'UNKNOWN', 'REGRIP', 'TRIGGER', 'SHAKE']),
  );
  const entries = signal<TraceEntry[]>([]);
  const diagnostics = signal<TraceEntry[]>([]);
  const allEntries = computed(() =>
    [...entries.value, ...diagnostics.value].sort((left, right) => left.id - right.id),
  );
  const visibleEntries = computed(() =>
    allEntries.value
      .filter((entry) => activeFilters.value.has(entry.category))
      .slice(-maxVisibleRows),
  );
  const selected = new Set<number>();
  let newestFirst = true;
  let autoFollow = true;
  let paused = false;
  /** Rows that existed at Pause time. Incoming entries keep capturing, but cannot alter this view. */
  let pausedEntries: readonly TraceEntry[] | undefined;
  let nextId = 1;
  let lastSelectedId: number | undefined;
  let focusedId: number | undefined;
  let contextId: number | undefined;
  const rows = new Map<number, HTMLElement>();
  let renderPending = false;
  let lastRenderedEntries: readonly TraceEntry[] = [];

  const displayedEntries = (): readonly TraceEntry[] =>
    pausedEntries === undefined
      ? visibleEntries.value
      : pausedEntries.filter((entry) => activeFilters.value.has(entry.category));

  const selectedEntries = (): TraceEntry[] =>
    allEntries.value.filter((entry) => selected.has(entry.id));
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
    follow.textContent = autoFollow ? 'Following' : 'Follow';
  };
  const updatePauseButton = (): void => {
    pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? 'Resume' : 'Pause';
  };

  const updateSelection = (): void => {
    const count = selected.size;
    selection.hidden = count === 0;
    selectionCount.textContent = `${count} selected`;
    reproduceButton.toggleAttribute('disabled', selectedMoves().length === 0);
  };

  const updateStats = (): void => {
    const captured = allEntries.value.length;
    const shown = displayedEntries().length;
    stats.textContent = `${captured} captured event${captured === 1 ? '' : 's'}${
      shown === captured ? '' : ` · ${shown} shown`
    }${paused ? ' · paused' : ''}`;
    if (collapsedBadge) {
      collapsedBadge.textContent = String(captured);
    }
  };

  const entryById = (id: number | undefined): TraceEntry | undefined =>
    allEntries.value.find((entry) => entry.id === id);

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

    const recordedMs = Date.parse(entry.log.recordedAt);
    const allEntries = entries.value;
    const firstMs = allEntries.length > 0 ? Date.parse(allEntries[0].log.recordedAt) : recordedMs;
    const deltaMs = isNaN(recordedMs) || isNaN(firstMs) ? 0 : recordedMs - firstMs;
    const deltaStr = deltaMs < 1000 ? `+${deltaMs}ms` : `+${(deltaMs / 1000).toFixed(3)}s`;

    if (detailBadge) {
      detailBadge.textContent = entry.category;
      detailBadge.dataset.category = entry.category;
      detailBadge.className = `trace-badge trace-badge-${entry.category.toLowerCase()}`;
    }
    if (detailSummary) {
      detailSummary.textContent = entry.message || entry.category;
    }
    if (detailTime) {
      detailTime.textContent = `${deltaStr} · ${displayTime(recordedMs)}`;
    }

    if (detailChips) {
      const chips = extractTraceChips(entry);
      detailChips.replaceChildren();
      if (chips.length > 0) {
        detailChips.hidden = false;
        for (const chip of chips) {
          const chipEl = document.createElement('span');
          chipEl.className = 'trace-chip';
          const labelSpan = document.createElement('span');
          labelSpan.className = 'trace-chip-label';
          labelSpan.textContent = `${chip.label}:`;
          const valueSpan = document.createElement('span');
          valueSpan.className = 'trace-chip-value';
          valueSpan.textContent = chip.value;
          chipEl.append(labelSpan, ' ', valueSpan);
          detailChips.appendChild(chipEl);
        }
      } else {
        detailChips.hidden = true;
      }
    }

    const rawJson = JSON.stringify(entry.log, null, 2);
    detailJson.replaceChildren(highlightJson(rawJson));
  };

  const contextDropdown = createDropdownMenu({
    menu: contextMenu,
    onClose: () => {
      contextId = undefined;
    },
  });
  const hideContextMenu = contextDropdown.close;

  const selectEntry = (id: number, range: boolean): void => {
    if (range && lastSelectedId !== undefined) {
      const start = displayedEntries().findIndex((entry) => entry.id === lastSelectedId);
      const end = displayedEntries().findIndex((entry) => entry.id === id);
      if (start !== -1 && end !== -1) {
        const [from, to] = start < end ? [start, end] : [end, start];
        displayedEntries()
          .slice(from, to + 1)
          .forEach((entry) => selected.add(entry.id));
      }
    } else if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    lastSelectedId = id;
    render();
  };

  const createRow = (entry: TraceEntry): HTMLElement => {
    const row = document.createElement('article');
    row.tabIndex = 0;
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'trace-badge';
    badge.addEventListener('click', (event) => {
      if (!(event as MouseEvent).shiftKey) return;
      event.stopPropagation();
      displayedEntries()
        .filter((candidate) => candidate.category === entry.category)
        .forEach((candidate) => selected.add(candidate.id));
      lastSelectedId = entry.id;
      render();
    });
    const timestamp = document.createElement('time');
    const message = document.createElement('span');
    message.className = 'trace-message';
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
      contextDropdown.open();
      contextMenu.style.left = `${event.clientX}px`;
      contextMenu.style.top = `${event.clientY}px`;
    });
    return row;
  };

  const patchRow = (row: HTMLElement, entry: TraceEntry): void => {
    const isSelected = selected.has(entry.id);
    row.className = `trace-row trace-${entry.category.toLowerCase()}`;
    row.dataset.traceId = String(entry.id);
    row.classList.toggle('is-selected', isSelected);
    row.classList.toggle('is-focused', focusedId === entry.id);
    row.setAttribute('aria-selected', String(isSelected));
    const badge = row.querySelector<HTMLButtonElement>('.trace-badge')!;
    badge.textContent = `${isSelected ? '✓ ' : ''}${entry.category}`;
    badge.title = `Open event details; Shift-click to select all ${entry.category} events`;
    row.querySelector('time')!.textContent = displayTime(Date.parse(entry.log.recordedAt));
    row.querySelector<HTMLElement>('.trace-message')!.textContent = entry.message;
  };

  const render = (): void => {
    const previousScrollTop = root.scrollTop;
    const displayed = displayedEntries();
    lastRenderedEntries = displayed;
    const ordered = newestFirst ? [...displayed].reverse() : displayed;
    const visibleIds = new Set(ordered.map((entry) => entry.id));
    rows.forEach((row, id) => {
      if (!visibleIds.has(id)) {
        row.remove();
        rows.delete(id);
      }
    });
    ordered.forEach((entry) => {
      const row = rows.get(entry.id) ?? createRow(entry);
      rows.set(entry.id, row);
      patchRow(row, entry);
      root.append(row);
    });
    updateSelection();
    updateStats();
    updateDetail();
    root.scrollTop = autoFollow ? followEdge() : previousScrollTop;
  };

  const requestRender = (): void => {
    if (renderPending) return;
    renderPending = true;
    const flush = (): void => {
      renderPending = false;
      if (!paused) render();
    };
    if (scheduleRender) scheduleRender(flush);
    else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
    else flush();
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
    let changedVisibleRows = activeFilters.value.has(category);
    while (nextEntries.length > maxBufferedEntries) {
      const removed = nextEntries.shift()!;
      changedVisibleRows ||= activeFilters.value.has(removed.category);
      selected.delete(removed.id);
      if (focusedId === removed.id) focusedId = undefined;
    }
    entries.value = nextEntries;
    updateStats();
    if (changedVisibleRows && !paused) requestRender();
    else {
      updateSelection();
      updateDetail();
    }
  };

  const appendDiagnostic = (event: SmartCubeSessionDiagnostic): void => {
    const bytes = [...event.bytes].slice(0, maxDiagnosticBytes);
    const data: JsonValue = {
      type: event.type,
      protocol: event.protocol,
      timestamp: event.timestamp,
      opcode: event.opcode ?? null,
      bytes,
      byteLength: event.bytes.length,
      truncated: event.bytes.length > bytes.length,
    };
    const log: LogEntry = {
      recordedAt: new Date(event.timestamp).toISOString(),
      type: 'transport_diagnostic',
      data,
    };
    const [, message] = describeLogEntry(log);
    const entry: TraceEntry = {
      id: nextId++,
      category: 'DIAGNOSTIC',
      message,
      log,
    };
    const nextDiagnostics = [...diagnostics.value, entry];
    while (nextDiagnostics.length > maxBufferedDiagnostics) {
      const removed = nextDiagnostics.shift()!;
      selected.delete(removed.id);
      if (focusedId === removed.id) focusedId = undefined;
    }
    diagnostics.value = nextDiagnostics;
    updateStats();
    if (activeFilters.value.has('DIAGNOSTIC') && !paused) requestRender();
    else {
      updateSelection();
      updateDetail();
    }
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
    diagnostics.value = [];
    if (paused) pausedEntries = [];
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
  pause.addEventListener('click', () => {
    if (paused) {
      paused = false;
      pausedEntries = undefined;
    } else {
      pausedEntries = [...lastRenderedEntries];
      paused = true;
    }
    updatePauseButton();
    updateStats();
    if (!paused) render();
  });
  root.addEventListener('scroll', () => {
    const nextAutoFollow = isAtFollowEdge();
    if (nextAutoFollow === autoFollow) return;
    autoFollow = nextAutoFollow;
    updateFollowButton();
  });
  selectAll.addEventListener('click', () => {
    displayedEntries().forEach((entry) => selected.add(entry.id));
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
  closeDetail?.addEventListener('click', () => {
    focusedId = undefined;
    detail.hidden = true;
    render();
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
  updateFollowButton();
  updatePauseButton();
  updateStats();

  return {
    append,
    appendDiagnostic,
    appendSessionEvent(event: SmartCubeSessionEvent): void {
      const [category, message] = describeSessionEvent(event);
      append(category, message, eventTimestamp(event), event);
    },
    appendLogEntry(entry: LogEntry): void {
      const [category, message] = describeLogEntry(entry);
      appendEntry(category, message, entry);
    },
    getEntries: (): readonly TraceEntry[] => allEntries.value,
    getVisibleEntries: (): readonly TraceEntry[] => displayedEntries(),
    getSelectedEntries: (): TraceEntry[] => selectedEntries(),
    toggleCollapse(): void {
      setCollapsed(!collapsed);
    },
    isCollapsed(): boolean {
      return collapsed;
    },
    setCollapsed,
  };
}
