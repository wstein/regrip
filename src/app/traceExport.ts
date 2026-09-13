import { JSONL_REPLAY_FORMAT, JSONL_REPLAY_VERSION } from '@wstein/regrip-core/session/jsonlFormat';
import type { SmartCubeSessionState } from '@wstein/regrip-core/session/smartCubeSession';

import { buildJsonlWithHeader, type JsonValue, type LogEntry } from './jsonlLog';

export type TraceExportScope = 'all' | 'filtered' | 'selected';

export function replayHeaderForState(state: SmartCubeSessionState): JsonValue {
  return {
    format: JSONL_REPLAY_FORMAT,
    version: JSONL_REPLAY_VERSION,
    session: {
      status: state.status,
      device: state.connection?.deviceName ?? null,
      deviceMAC: state.connection?.deviceMAC ?? null,
      protocol: state.connection?.protocol ?? null,
      profile: state.profile.id,
      profileValue: state.profile.value,
    },
  };
}

type ScopedTraceOptions = {
  scope: string;
  header: JsonValue;
  all: () => string;
  filtered: readonly LogEntry[];
  selected: readonly LogEntry[];
  now?: () => string;
};

export function scopedTraceJsonl(
  options: ScopedTraceOptions,
): { contents: string; error?: never } | { contents?: never; error: string } {
  if (options.scope === 'all') return { contents: options.all() };
  const entries = options.scope === 'selected' ? options.selected : options.filtered;
  if (options.scope === 'selected' && entries.length === 0) {
    return { error: 'Select trace events first.' };
  }
  return { contents: buildJsonlWithHeader(options.header, entries, options.now) };
}
