// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDropdownMenu } from './dom';

afterEach(() => {
  document.body.replaceChildren();
});

describe('dropdown menu', () => {
  it('toggles accessibly and dismisses on Escape or an outside click', () => {
    document.body.innerHTML = `
      <button id="toggle" aria-expanded="false">Open</button>
      <div id="menu" hidden><button id="inside">Choice</button></div>
      <button id="outside">Outside</button>`;
    const toggle = document.getElementById('toggle')!;
    const menu = document.getElementById('menu')!;
    const onClose = vi.fn();
    const dropdown = createDropdownMenu({ toggle, menu, onClose });

    toggle.click();
    expect(menu.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);

    toggle.click();
    document.getElementById('inside')!.click();
    expect(menu.hidden).toBe(false);
    document.getElementById('outside')!.click();
    expect(menu.hidden).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
    dropdown.destroy();
  });
});
