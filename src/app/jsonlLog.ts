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

type LogListener = (entry: LogEntry, recordingCount: number) => void;

const maxEntries = 10_000;

/**
 * Bounded, always-on JSONL event buffer. Recording marks an export cursor;
 * browser download is deliberately kept at the UI edge.
 */
export function createJsonlLog(now: () => string = () => new Date().toISOString()) {
  let entries: LogEntry[] = [];
  let active = false;
  let cursor = 0;
  let recordedEventCount = 0;
  const listeners = new Set<LogListener>();

  const record = (type: string, data: JsonValue): void => {
    const entry = { recordedAt: now(), type, data };
    entries.push(entry);
    while (entries.length > maxEntries) {
      entries.shift();
      cursor = Math.max(0, cursor - 1);
    }
    if (active && type !== 'log_started' && type !== 'log_stopped') recordedEventCount += 1;
    listeners.forEach((listener) => listener(entry, recordedEventCount));
  };

  return {
    get active(): boolean {
      return active;
    },
    get recordingCount(): number {
      return recordedEventCount;
    },
    start(context: JsonValue): void {
      cursor = entries.length;
      recordedEventCount = 0;
      active = true;
      record('log_started', context);
    },
    record,
    stop(): string {
      record('log_stopped', { entries: recordedEventCount });
      active = false;
      return serializeJsonl(entries.slice(cursor));
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
