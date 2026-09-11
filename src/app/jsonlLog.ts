export type JsonValue = Record<string, unknown>;

export type LogEntry = {
  recordedAt: string;
  type: string;
  data: JsonValue;
};

export function serializeJsonl(entries: readonly LogEntry[]): string {
  return (
    entries.map((entry) => JSON.stringify(entry)).join('\n') + (entries.length > 0 ? '\n' : '')
  );
}

type LogListener = (entry: LogEntry) => void;
type RecordOptions = { dedupeKey?: string };

const maxEntries = 10_000;

/**
 * Bounded, always-on JSONL event buffer. A replay header is added only when
 * the current buffer is exported; browser download remains at the UI edge.
 */
export function createJsonlLog(now: () => string = () => new Date().toISOString()) {
  let entries: LogEntry[] = [];
  let lastDedupeKey: string | undefined;
  const listeners = new Set<LogListener>();

  const record = (type: string, data: JsonValue, { dedupeKey }: RecordOptions = {}): boolean => {
    const key = dedupeKey === undefined ? undefined : `${type}:${dedupeKey}`;
    if (key !== undefined && key === lastDedupeKey) return false;
    const entry = { recordedAt: now(), type, data };
    entries.push(entry);
    if (key !== undefined) lastDedupeKey = key;
    while (entries.length > maxEntries) {
      entries.shift();
    }
    listeners.forEach((listener) => listener(entry));
    return true;
  };

  return {
    record,
    clear(): void {
      entries = [];
      lastDedupeKey = undefined;
    },
    toJsonl(header: JsonValue): string {
      return serializeJsonl([
        { recordedAt: now(), type: 'trace_header', data: header },
        ...entries,
      ]);
    },
    subscribe(listener: LogListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function downloadJsonl(contents: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/x-ndjson' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  // Safari and Firefox require the link to be attached, and can begin the
  // download after this call returns. Release the URL on the next task.
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
