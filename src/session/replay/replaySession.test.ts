import { describe, expect, it, vi } from 'vitest';

import { createReplaySession } from './replaySession';

const header =
  '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"trace_header","data":{"format":"regrip","version":1}}';
const rawLog = [
  header,
  '{"recordedAt":"2026-09-09T10:00:00.010Z","type":"cube_event","data":{"type":"BATTERY","timestamp":10,"batteryLevel":98}}',
  '{"recordedAt":"2026-09-09T10:00:00.020Z","type":"cube_event","data":{"type":"MOVE","timestamp":20,"move":"R"}}',
].join('\n');
const sessionLog = [
  header,
  '{"recordedAt":"2026-09-09T10:00:00.010Z","type":"gyro_stabilizer","data":{"timestamp":10,"quaternion":{"x":0,"y":0,"z":0,"w":1},"relative":{"x":0,"y":0,"z":0,"w":1},"stabilized":{"x":0,"y":0,"z":0,"w":1},"velocityMagnitude":0,"dtSeconds":0}}',
  '{"recordedAt":"2026-09-09T10:00:00.020Z","type":"virtual_regrip","data":{"timestamp":20,"notationToken":"y","sensorFrameToken":"y"}}',
].join('\n');
const identifiedHeader =
  '{"recordedAt":"2026-09-09T10:00:00.000Z","type":"trace_header","data":{"format":"regrip","version":1,"session":{"device":"GoCube Edge","protocol":"gocube"}}}';
const lifecycleLog = [
  header,
  '{"recordedAt":"2026-09-09T10:00:00.001Z","type":"session_status","data":{"status":"connecting"}}',
  '{"recordedAt":"2026-09-09T10:00:00.002Z","type":"session_status","data":{"status":"connected"}}',
  '{"recordedAt":"2026-09-09T10:00:00.003Z","type":"gyro_stabilizer","data":{"timestamp":30,"quaternion":{"x":0,"y":0,"z":0,"w":1},"relative":{"x":0,"y":0,"z":0,"w":1},"stabilized":{"x":0,"y":0,"z":0,"w":1},"velocityMagnitude":0,"dtSeconds":0}}',
  '{"recordedAt":"2026-09-09T10:00:00.004Z","type":"session_status","data":{"status":"disconnected"}}',
].join('\n');

describe('replay session', () => {
  it('anchors playback at the first captured timestamp without emitting it', async () => {
    const replay = createReplaySession(rawLog, 'connection');

    expect(replay.position).toBe(0);
    expect(replay.virtualNowMs).toBe(10);
    await replay.advanceTo(10);
    expect(replay.position).toBe(1);
  });

  it('feeds raw cube events through a fresh session one virtual step at a time', async () => {
    const replay = createReplaySession(rawLog, 'connection');
    const events: string[] = [];
    replay.session.subscribeEvents((event) => events.push(event.type));

    await replay.stepOne();
    await replay.advanceTo(20);

    expect(replay.position).toBe(2);
    expect(replay.virtualNowMs).toBe(20);
    expect(events).toEqual(['BATTERY', 'MOVE']);

    await replay.seekTo(1);
    expect(replay.position).toBe(1);
    expect(replay.session.getState().lastEvent?.type).toBe('BATTERY');
  });

  it('feeds recorded derived events without running detectors in session-output mode', async () => {
    const replay = createReplaySession(sessionLog, 'session');
    const events: string[] = [];
    replay.session.subscribeEvents((event) => events.push(event.type));

    await replay.advanceTo(20);

    expect(events).toEqual(['GYRO', 'REGRIP']);
    expect(replay.done).toBe(true);
  });

  it('reconstructs connection-feed gyro from older stabilized-only exports', async () => {
    const replay = createReplaySession(sessionLog, 'connection');
    const events: string[] = [];
    replay.session.subscribeEvents((event) => events.push(event.type));

    await replay.advanceTo(10);

    expect(replay.length).toBe(1);
    expect(events).toEqual(['GYRO']);
  });

  it('retains the captured device profile in session-output mode', () => {
    const replay = createReplaySession(
      [identifiedHeader, ...rawLog.split('\n').slice(1)].join('\n'),
      'session',
    );

    expect(replay.session.getState().profile.id).toBe('gocube');
  });

  it('serializes overlapping seeks so only the latest target populates the rebuilt session', async () => {
    const replay = createReplaySession(rawLog, 'connection');

    await Promise.all([replay.seekTo(2), replay.seekTo(1)]);

    expect(replay.position).toBe(1);
    expect(replay.session.getState().lastEvent?.type).toBe('BATTERY');
  });

  it('continues forward seeks without rebuilding and replaying the existing prefix', async () => {
    const replay = createReplaySession(rawLog, 'connection');
    const events: string[] = [];
    replay.session.subscribeEvents((event) => events.push(event.type));

    await replay.seekTo(1);
    await replay.seekTo(2);

    expect(events).toEqual(['BATTERY', 'MOVE']);
  });

  it('notifies hosts before a backward seek rebuilds the session', async () => {
    const replay = createReplaySession(rawLog, 'connection');
    const rebuild = vi.fn();
    replay.subscribeRebuild(rebuild);

    await replay.seekTo(2);
    await replay.seekTo(1);

    expect(rebuild).toHaveBeenCalledTimes(1);
  });

  it('seeks by timestamp with the same inclusive boundary as forward playback', async () => {
    const replay = createReplaySession(rawLog, 'connection');

    await replay.seekToTimestamp(5);
    expect(replay.position).toBe(0);

    await replay.seekToTimestamp(10);
    expect(replay.position).toBe(1);

    await replay.seekToTimestamp(15);
    expect(replay.position).toBe(1);
  });

  it('preserves captured lifecycle order in session-output mode', async () => {
    const replay = createReplaySession(lifecycleLog, 'session');
    const timeline: string[] = [];
    replay.session.subscribe((state) => timeline.push(`status:${state.status}`));
    replay.session.subscribeEvents((event) => timeline.push(`event:${event.type}`));

    await replay.advanceTo(Number.MAX_SAFE_INTEGER);

    expect(timeline.slice(-5)).toEqual([
      // The replay facade connects its output host before applying capture rows;
      // the final connected state is the captured row itself.
      'status:connecting',
      'status:connected',
      'status:connected',
      'event:GYRO',
      'status:disconnected',
    ]);
  });

  it('skips malformed derived session events instead of emitting invalid values', async () => {
    const replay = createReplaySession(
      [
        sessionLog,
        '{"recordedAt":"2026-09-09T10:00:00.030Z","type":"gyro_stabilizer","data":{"timestamp":30}}',
        '{"recordedAt":"2026-09-09T10:00:00.040Z","type":"virtual_regrip","data":{"timestamp":40,"notationToken":"bad","sensorFrameToken":"x"}}',
        '{"recordedAt":"2026-09-09T10:00:00.050Z","type":"custom_trigger","data":{"timestamp":50}}',
      ].join('\n'),
      'session',
    );
    const events: string[] = [];
    replay.session.subscribeEvents((event) => events.push(event.type));

    await replay.advanceTo(Number.MAX_SAFE_INTEGER);

    expect(replay.length).toBe(2);
    expect(events).toEqual(['GYRO', 'REGRIP']);
  });
});
