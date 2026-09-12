import { describe, expect, it } from 'vitest';

import {
  describeDiagnostic,
  describeLogEntry,
  describeSessionEvent,
  extractTraceChips,
} from './liveLog';

describe('live trace event classification', () => {
  it('uses concise, filterable categories for session-only events', () => {
    expect(
      describeSessionEvent({
        type: 'REGRIP',
        timestamp: 1,
        notationToken: "y'",
        sensorFrameToken: 'y',
      }),
    ).toEqual(['REGRIP', "y' (y)"]);
    expect(describeSessionEvent({ type: 'CUSTOM_TRIGGER', timestamp: 1, move: 'R' })).toEqual([
      'TRIGGER',
      'R',
    ]);
    expect(
      describeSessionEvent({ type: 'SHAKE', timestamp: 240, steps: 4, reversals: 3, spanMs: 180 }),
    ).toEqual(['SHAKE', '4 steps, 3 reversals']);
  });

  it('uses one descriptor for session rows, recorded rows, and inspector chips', () => {
    const event = {
      type: 'MOVE_GAP',
      timestamp: 10,
      previousSerial: 4,
      serial: 7,
      missing: 2,
    } as const;
    const log = {
      recordedAt: '2026-09-09T10:00:00.000Z',
      type: 'move_gap',
      data: event,
    } as const;

    expect(describeSessionEvent(event)).toEqual(['STATE', '2 missed moves']);
    expect(describeLogEntry(log)).toEqual(describeSessionEvent(event));
    expect(extractTraceChips({ id: 1, category: 'STATE', message: '2 missed moves', log })).toEqual(
      [{ label: 'State', value: '2 missed moves' }],
    );
  });

  it('summarizes high-rate gyro data without flooding the line', () => {
    expect(
      describeSessionEvent({
        type: 'GYRO',
        timestamp: 1,
        quaternion: { x: 0.1234, y: -0.5678, z: 0.9, w: 0 },
        relative: { x: 0, y: 0, z: 0, w: 1 },
        stabilized: { x: 0, y: 0, z: 0, w: 1 },
        velocityMagnitude: 0,
        dtSeconds: 0,
      }),
    ).toEqual(['GYRO', 'q 0.12, -0.57, 0.90']);
  });

  it('uses the recorder entry as the canonical trace source', () => {
    expect(
      describeLogEntry({
        recordedAt: '2026-09-09T10:00:00.000Z',
        type: 'cube_event',
        data: { type: 'MOVE', move: 'R' },
      }),
    ).toEqual(['MOVE', 'R']);
    expect(
      describeLogEntry({
        recordedAt: '2026-09-09T10:00:00.000Z',
        type: 'virtual_regrip',
        data: { notationToken: "y'", sensorFrameToken: 'y', solverToken: 'z' },
      }),
    ).toEqual(['REGRIP', 'z (y)']);
    expect(
      describeLogEntry({
        recordedAt: '2026-09-09T10:00:00.000Z',
        type: 'shake_trigger',
        data: { steps: 4, reversals: 3, spanMs: 180 },
      }),
    ).toEqual(['SHAKE', '4 steps, 3 reversals']);
  });

  it('summarizes hardware and authoritative facelet events', () => {
    expect(
      describeLogEntry({
        recordedAt: '2026-09-09T10:00:00.000Z',
        type: 'cube_event',
        data: {
          type: 'HARDWARE',
          hardwareName: 'GANicAgy',
          hardwareVersion: '0.1',
          softwareVersion: '3.22',
        },
      }),
    ).toEqual(['EVENT', 'GANicAgy · HW 0.1 · SW 3.22']);
    expect(
      describeLogEntry({
        recordedAt: '2026-09-09T10:00:00.000Z',
        type: 'cube_event',
        data: { type: 'FACELETS', serial: 189, facelets: 'U'.repeat(54) },
      }),
    ).toEqual(['EVENT', 'facelets #189 · 54 stickers']);
  });

  it('makes unknown normalized device events visible without discarding their JSON detail', () => {
    expect(
      describeLogEntry({
        recordedAt: '2026-09-09T10:00:00.000Z',
        type: 'cube_event',
        data: { type: 'FUTURE_EVENT', timestamp: 1, payload: { mode: 7 } },
      }),
    ).toEqual(['UNKNOWN', 'unknown event · FUTURE_EVENT']);
  });

  it('summarizes a cube command with its dispatch status', () => {
    expect(
      describeLogEntry({
        recordedAt: '2026-09-09T10:00:00.000Z',
        type: 'cube_command',
        data: { name: 'Sync state', status: 'sent', error: null },
      }),
    ).toEqual(['COMMAND', 'Sync state · sent']);
    expect(
      describeLogEntry({
        recordedAt: '2026-09-09T10:00:00.000Z',
        type: 'cube_command',
        data: { name: 'Sync state', status: 'sent', reason: 'move_gap', error: null },
      }),
    ).toEqual(['COMMAND', 'Sync state · sent · move gap']);
  });

  it('renders raw transport diagnostics as a separate debug category', () => {
    expect(
      describeDiagnostic({
        type: 'UNKNOWN_PACKET',
        protocol: 'qiyi',
        timestamp: 1,
        opcode: 0xfe,
        bytes: [0x55, 0xfe, 0x0a],
      }),
    ).toBe('qiyi opcode 0xfe · 3 bytes · 55 fe 0a');
    expect(
      describeLogEntry({
        recordedAt: '2026-09-09T10:00:00.000Z',
        type: 'transport_diagnostic',
        data: {
          protocol: 'qiyi',
          opcode: 254,
          bytes: [85, 254],
          byteLength: 700,
          truncated: true,
        },
      }),
    ).toEqual(['DIAGNOSTIC', 'qiyi opcode 0xfe · 700 bytes · 55 fe (truncated)']);
  });
});
