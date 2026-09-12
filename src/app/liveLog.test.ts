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

  it('covers the complete session-event descriptor vocabulary', () => {
    const cases = [
      [{ type: 'BATTERY', timestamp: 1, batteryLevel: 87 }, ['EVENT', 'battery 87%']],
      [{ type: 'DISCONNECT', timestamp: 2 }, ['STATE', 'cube disconnected']],
      [
        {
          type: 'HARDWARE',
          timestamp: 3,
          hardwareName: 'GAN',
          hardwareVersion: '1',
          softwareVersion: '2',
        },
        ['EVENT', 'GAN · HW 1 · SW 2'],
      ],
      [
        { type: 'FACELETS', timestamp: 4, facelets: 'U'.repeat(54) },
        ['EVENT', 'facelets · 54 stickers'],
      ],
    ] as const;

    for (const [event, expected] of cases) {
      expect(describeSessionEvent(event as Parameters<typeof describeSessionEvent>[0])).toEqual(
        expected,
      );
    }
    expect(
      describeSessionEvent({
        type: 'GYRO',
        timestamp: 5,
        quaternion: {} as never,
        relative: {} as never,
        stabilized: {} as never,
        velocityMagnitude: 0,
        dtSeconds: 0,
      }),
    ).toEqual(['GYRO', 'gyro']);
  });

  it('describes recorder lifecycle entries and fallback entries', () => {
    const at = '2026-09-09T10:00:00.000Z';
    expect(
      describeLogEntry({ recordedAt: at, type: 'session_status', data: { status: 'connected' } }),
    ).toEqual(['STATE', 'connected']);
    expect(describeLogEntry({ recordedAt: at, type: 'log_started', data: {} })).toEqual([
      'STATE',
      'recording started',
    ]);
    expect(describeLogEntry({ recordedAt: at, type: 'log_stopped', data: { entries: 9 } })).toEqual(
      ['STATE', 'recording stopped · 9 events'],
    );
    expect(
      describeLogEntry({ recordedAt: at, type: 'profile_selected', data: { id: 'gan' } }),
    ).toEqual(['EVENT', 'profile gan']);
    expect(describeLogEntry({ recordedAt: at, type: 'future_record' as never, data: {} })).toEqual([
      'EVENT',
      'future record',
    ]);
    expect(describeLogEntry({ recordedAt: at, type: 'cube_event', data: {} })).toEqual([
      'UNKNOWN',
      'unknown cube event',
    ]);
  });

  it('extracts all available quick-glance chips', () => {
    const log = {
      recordedAt: '2026-09-09T10:00:00.000Z',
      type: 'future_record',
      data: {
        move: 'F',
        battery: 42,
        hardwareName: 'Cube',
        facelets: ['U', 'R'],
        quaternion: { x: 0.125, y: -0.25, z: 0.5 },
        opcode: 7,
        bytes: [1, 2, 3],
      },
    } as never;
    expect(extractTraceChips({ id: 1, category: 'MOVE', message: 'F', log })).toEqual([
      { label: 'Move', value: 'F' },
      { label: 'Battery', value: '42%' },
      { label: 'Hardware', value: 'Cube' },
      { label: 'Facelets', value: '2 stickers' },
      { label: 'Quat', value: '[0.13, -0.25, 0.50]' },
      { label: 'Opcode', value: '0x07' },
      { label: 'Payload', value: '3 B' },
    ]);

    const entry = {
      id: 2,
      category: 'MOVE' as const,
      message: 'R',
      log: {
        recordedAt: '2026-09-09T10:00:00.000Z',
        type: 'cube_event' as const,
        data: { type: 'MOVE', move: 'R', face: 'R', turns: 1, amount: -1, batteryLevel: 91 },
      },
    };
    expect(extractTraceChips(entry)).toEqual([
      { label: 'Move', value: 'R' },
      { label: 'Face', value: 'R' },
      { label: 'Turns', value: '1' },
      { label: 'Amount', value: '-1' },
      { label: 'Battery', value: '91%' },
    ]);

    const descriptorEntries = [
      { type: 'REGRIP', data: { notationToken: 'y', sensorFrameToken: 'x' }, category: 'REGRIP' },
      { type: 'CUSTOM_TRIGGER', data: { move: 'U' }, category: 'TRIGGER' },
      { type: 'SHAKE', data: { steps: 4, reversals: 3 }, category: 'SHAKE' },
      { type: 'cube_command', data: { name: 'Sync', status: 'sent' }, category: 'COMMAND' },
      { type: 'FACELETS', data: { facelets: 'U'.repeat(54) }, category: 'EVENT' },
    ] as const;
    for (const [index, item] of descriptorEntries.entries()) {
      const chips = extractTraceChips({
        id: index + 3,
        category: item.category,
        message: item.type,
        log: {
          recordedAt: '2026-09-09T10:00:00.000Z',
          type: item.type === 'cube_command' ? item.type : 'cube_event',
          data: item.type === 'cube_command' ? item.data : { type: item.type, ...item.data },
        } as never,
      });
      expect(chips.length).toBeGreaterThan(0);
    }
  });
});
