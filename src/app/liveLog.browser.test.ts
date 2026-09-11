// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLiveLog } from './liveLog';

const filters = ['MOVE', 'EVENT', 'STATE', 'GYRO', 'REGRIP', 'TRIGGER', 'SHAKE'];

function mountTrace(): void {
  document.body.innerHTML = `
    <button id="clear-trace"></button><button id="sort-trace"></button><button id="follow-trace"></button>
    <span id="trace-stats"></span>
    <div class="trace-filters">${filters.map((category) => `<button data-trace-filter="${category}"></button>`).join('')}</div>
    <div id="trace-selection" hidden><span id="trace-selection-count"></span>
      <button id="select-all-trace"></button><button id="export-trace"></button>
      <button id="copy-trace"></button><button id="reproduce-trace"></button><button id="clear-trace-selection"></button>
    </div>
    <div id="event-log-rows"></div>
    <section id="trace-detail" hidden><span id="trace-detail-summary"></span>
      <button id="copy-trace-detail"></button>
      <pre id="trace-detail-json"></pre>
    </section>
    <menu id="trace-context-menu" hidden><button id="select-trace-event"></button>
      <button id="copy-trace-event"></button><button id="export-trace-event"></button>
    </menu>`;
}

function click(selector: string, options: MouseEventInit = {}): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, ...options }));
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('live trace browser interactions', () => {
  it('keeps filtered events in the trace and shows a clicked event in the fixed detail pane', () => {
    mountTrace();
    const trace = createLiveLog({ now: () => new Date('2026-09-09T10:00:00.000Z') });
    trace.append('GYRO', 'hidden');
    trace.append('EVENT', 'battery 98%', undefined, { battery: 98 });

    expect(trace.getEntries()).toHaveLength(2);
    expect(trace.getVisibleEntries()).toHaveLength(1);
    expect(document.querySelector('[data-trace-id="1"]')).toBeNull();
    click('[data-trace-filter="GYRO"]');
    expect(trace.getVisibleEntries()).toHaveLength(2);
    expect(document.querySelector('[data-trace-id="1"]')).not.toBeNull();
    trace.append('GYRO', 'visible', undefined, { x: 0.1 });
    expect(trace.getEntries()).toHaveLength(3);

    click('[data-trace-id="3"]');
    expect(document.querySelector<HTMLElement>('#trace-detail')?.hidden).toBe(false);
    expect(document.querySelector('#trace-detail-json')?.textContent).toContain('"x": 0.1');
    expect(document.querySelector('[data-trace-id="3"] .trace-details')).toBeNull();
    expect(document.querySelector('#export-trace-detail')).toBeNull();
  });

  it('supports shift-click ranges, type bulk selection, copy, export, and local move reproduction', async () => {
    mountTrace();
    const reproduce = vi.fn();
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: copy },
      configurable: true,
    });
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:trace');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const trace = createLiveLog({
      onReproduceMoves: reproduce,
      now: () => new Date('2026-09-09T10:00:00.000Z'),
    });
    trace.append('MOVE', 'R', 1, { move: 'R' });
    trace.append('EVENT', 'battery', 2, { battery: 98 });
    trace.append('MOVE', "U'", 3, { move: "U'" });

    click('[data-trace-id="1"]', { shiftKey: true });
    click('[data-trace-id="3"]', { shiftKey: true });
    expect(trace.getSelectedEntries().map((entry) => entry.message)).toEqual([
      'R',
      'battery',
      "U'",
    ]);

    click('#clear-trace-selection');
    click('[data-trace-id="1"] .trace-badge', { shiftKey: true });
    expect(trace.getSelectedEntries().map((entry) => entry.message)).toEqual(['R', "U'"]);
    expect(document.querySelector('#trace-selection-count')?.textContent).toBe('2 selected');
    expect(document.querySelector('[data-trace-id="1"]')?.classList.contains('is-selected')).toBe(
      true,
    );
    expect(document.querySelector('[data-trace-id="1"] .trace-badge')?.textContent).toBe('✓ MOVE');

    click('[data-trace-id="1"] .trace-badge');
    expect(document.querySelector<HTMLElement>('#trace-detail')?.hidden).toBe(false);
    expect(document.querySelector('#trace-detail-json')?.textContent).toContain('"move": "R"');

    click('#copy-trace');
    await Promise.resolve();
    expect(copy).toHaveBeenCalledWith(expect.stringContaining('"move":"R"'));

    click('#export-trace');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchorClick).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(await blob.text()).toContain('"move":"U\'"');

    click('#reproduce-trace');
    expect(reproduce).toHaveBeenCalledWith(['R', "U'"]);
  });

  it('offers single-event actions from the row context menu', async () => {
    mountTrace();
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: copy },
      configurable: true,
    });
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:trace-event');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const trace = createLiveLog();
    trace.append('MOVE', 'R', 1, { move: 'R' });

    const row = document.querySelector<HTMLElement>('[data-trace-id="1"]')!;
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 12, clientY: 34 }));
    expect(document.querySelector<HTMLElement>('#trace-context-menu')?.hidden).toBe(false);

    click('#select-trace-event');
    expect(trace.getSelectedEntries().map((entry) => entry.message)).toEqual(['R']);
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    click('#copy-trace-event');
    await Promise.resolve();
    expect(copy).toHaveBeenCalledWith(expect.stringContaining('"move":"R"'));

    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    click('#export-trace-event');
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it('clears the always-on export buffer with the visible trace', () => {
    mountTrace();
    const onClear = vi.fn();
    const trace = createLiveLog({ onClear });
    expect(document.querySelector('#trace-stats')?.textContent).toBe('0 captured events');
    trace.append('MOVE', 'R');
    expect(document.querySelector('#trace-stats')?.textContent).toBe('1 captured event');
    trace.append('EVENT', 'battery');
    expect(document.querySelector('#trace-stats')?.textContent).toBe('2 captured events');

    click('#clear-trace');

    expect(trace.getEntries()).toEqual([]);
    expect(document.querySelector('#trace-stats')?.textContent).toBe('0 captured events');
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('retains hidden categories without displacing the filtered trace', () => {
    mountTrace();
    const trace = createLiveLog();
    trace.append('MOVE', 'R');
    for (let index = 0; index < 301; index += 1) trace.append('GYRO', `q ${index}`);

    expect(trace.getEntries()).toHaveLength(302);
    expect(trace.getVisibleEntries().map((entry) => entry.message)).toEqual(['R']);
    expect(document.querySelector('#event-log-rows')?.textContent).toContain('R');
    expect(document.querySelector('#trace-stats')?.textContent).toBe(
      '302 captured events · 1 shown',
    );
  });

  it('pauses auto-follow after manual scrolling and resumes from Newest', () => {
    mountTrace();
    const root = document.querySelector<HTMLElement>('#event-log-rows')!;
    Object.defineProperties(root, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
    });
    const trace = createLiveLog();

    trace.append('EVENT', 'first');
    root.scrollTop = 240;
    root.dispatchEvent(new Event('scroll'));
    trace.append('EVENT', 'second');

    expect(root.scrollTop).toBe(240);
    expect(document.querySelector<HTMLButtonElement>('#follow-trace')?.disabled).toBe(false);

    click('#follow-trace');
    trace.append('EVENT', 'third');
    expect(root.scrollTop).toBe(0);
    expect(document.querySelector<HTMLButtonElement>('#follow-trace')?.disabled).toBe(true);
  });
});
