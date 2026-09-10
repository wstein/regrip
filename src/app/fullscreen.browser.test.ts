// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mountFullscreenToggle } from './fullscreen';

function mountButton(): HTMLButtonElement {
  document.body.innerHTML = '<button id="fullscreen">placeholder</button>';
  return document.getElementById('fullscreen') as HTMLButtonElement;
}

afterEach(() => {
  Reflect.deleteProperty(document, 'fullscreenEnabled');
  Reflect.deleteProperty(document, 'fullscreenElement');
  Reflect.deleteProperty(document, 'exitFullscreen');
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
});

describe('mountFullscreenToggle', () => {
  it('removes the button where the Fullscreen API is unavailable', () => {
    const button = mountButton(); // jsdom has no fullscreen support
    mountFullscreenToggle();
    expect(document.getElementById('fullscreen')).toBeNull();
    expect(button.isConnected).toBe(false);
  });

  it('toggles fullscreen on click and reflects the resulting state', () => {
    const button = mountButton();
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    });
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const exitFullscreen = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = requestFullscreen;
    Object.defineProperty(document, 'exitFullscreen', {
      value: exitFullscreen,
      configurable: true,
    });

    mountFullscreenToggle();
    expect(button.textContent).toBe('⛶ Fullscreen');
    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    expect(requestFullscreen).toHaveBeenCalledOnce();

    // The browser has entered fullscreen and fired the event.
    (document as { fullscreenElement: Element | null }).fullscreenElement =
      document.documentElement;
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(button.textContent).toBe('⛶ Exit fullscreen');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });
});
