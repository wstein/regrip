import { describe, expect, it } from 'vitest';

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

describe('replay session', () => {
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

  it('retains the captured device profile in session-output mode', () => {
    const replay = createReplaySession(
      [identifiedHeader, ...rawLog.split('\n').slice(1)].join('\n'),
      'session',
    );

    expect(replay.session.getState().profile.id).toBe('gocube');
  });
});
