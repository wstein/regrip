// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLiveLog } from './liveLog';

const filters = ['MOVE', 'EVENT', 'STATE', 'GYRO', 'REGRIP', 'TRIGGER'];

function mountTrace(): void {
  document.body.innerHTML = `
    <button id="clear-trace"></button><button id="sort-trace"></button>
    <div class="trace-filters">${filters.map(category => `<button data-trace-filter="${category}"></button>`).join('')}</div>
    <div id="trace-selection" hidden><span id="trace-selection-count"></span>
      <button id="select-all-trace"></button><button id="export-trace"></button>
      <button id="copy-trace"></button><button id="reproduce-trace"></button><button id="clear-trace-selection"></button>
    </div>
    <div id="event-log-rows"></div>`;
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
  it('filters future events and expands an event into its local JSON detail', () => {
    mountTrace();
    const trace = createLiveLog({ now: () => new Date('2026-09-09T10:00:00.000Z') });
    trace.append('GYRO', 'hidden');
    trace.append('EVENT', 'battery 98%', undefined, { battery: 98 });

    expect(trace.getEntries()).toHaveLength(1);
    click('[data-trace-filter="GYRO"]');
    trace.append('GYRO', 'visible', undefined, { x: 0.1 });
    expect(trace.getEntries()).toHaveLength(2);

    click('[data-trace-id="2"]');
    const details = document.querySelector<HTMLPreElement>('[data-trace-id="2"] .trace-details')!;
    expect(details.hidden).toBe(false);
    expect(details.textContent).toContain('"x": 0.1');
  });

  it('supports checkbox ranges, type bulk selection, copy, export, and local move reproduction', async () => {
    mountTrace();
    const reproduce = vi.fn();
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: copy }, configurable: true });
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:trace');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const trace = createLiveLog({ onReproduceMoves: reproduce, now: () => new Date('2026-09-09T10:00:00.000Z') });
    trace.append('MOVE', 'R', 1, { move: 'R' });
    trace.append('EVENT', 'battery', 2, { battery: 98 });
    trace.append('MOVE', "U'", 3, { move: "U'" });

    click('[data-trace-id="1"] .trace-select');
    click('[data-trace-id="3"] .trace-select', { shiftKey: true });
    expect(trace.getSelectedEntries().map(entry => entry.message)).toEqual(['R', 'battery', "U'"]);

    click('#clear-trace-selection');
    click('[data-trace-id="1"] .trace-badge');
    expect(trace.getSelectedEntries().map(entry => entry.message)).toEqual(['R', "U'"]);
    expect(document.querySelector('#trace-selection-count')?.textContent).toBe('2 selected');

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
});
