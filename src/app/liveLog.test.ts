import { describe, expect, it } from 'vitest';

import { describeLogEntry, describeSessionEvent } from './liveLog';

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

  it('summarizes a cube command with its dispatch status', () => {
    expect(
      describeLogEntry({
        recordedAt: '2026-09-09T10:00:00.000Z',
        type: 'cube_command',
        data: { name: 'Sync state', status: 'sent', error: null },
      }),
    ).toEqual(['EVENT', 'Sync state · sent']);
  });
});
