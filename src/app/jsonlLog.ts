type JsonValue = Record<string, unknown>;

type LogEntry = {
  recordedAt: string;
  type: string;
  data: JsonValue;
};

/** In-memory JSONL recorder. Browser download is deliberately kept at the UI edge. */
export function createJsonlLog(now: () => string = () => new Date().toISOString()) {
  let entries: LogEntry[] = [];
  let active = false;

  const record = (type: string, data: JsonValue): void => {
    if (active) entries.push({ recordedAt: now(), type, data });
  };

  return {
    get active(): boolean { return active; },
    start(context: JsonValue): void {
      entries = [];
      active = true;
      record('log_started', context);
    },
    record,
    stop(): string {
      record('log_stopped', { entries: entries.length });
      active = false;
      return entries.map(entry => JSON.stringify(entry)).join('\n') + (entries.length > 0 ? '\n' : '');
    },
  };
}

export function downloadJsonl(contents: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/x-ndjson' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
