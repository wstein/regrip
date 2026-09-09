// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCommandPanel } from './commandPanel';

afterEach(() => document.body.replaceChildren());

describe('command panel', () => {
  it('renders only supported controls and confirms reboot before sending it', async () => {
    document.body.innerHTML = '<section id="command-panel" hidden></section>';
    const sendCommand = vi.fn(async () => {});
    const sendVendorCommand = vi.fn(async () => {});
    const onResult = vi.fn();
    const confirm = vi.fn(() => false);
    const panel = createCommandPanel();

    panel.render(
      {
        gyroscope: true,
        battery: true,
        facelets: true,
        hardware: false,
        reset: true,
        vendorCommands: ['REBOOT', 'TOGGLE_BACKLIGHT'],
      },
      { sendCommand, sendVendorCommand, onResult, confirm },
    );

    expect(document.querySelector<HTMLElement>('#command-panel')?.hidden).toBe(false);
    expect(document.querySelector('#command-panel')?.textContent).toContain('Sync state');
    expect(document.querySelector('#command-panel')?.textContent).toContain('Toggle light');
    expect(document.querySelector('#command-panel')?.textContent).not.toContain('Calibrate gyro');

    document.querySelector<HTMLButtonElement>('#command-panel button')!.click();
    await Promise.resolve();
    expect(sendCommand).toHaveBeenCalledWith({ type: 'REQUEST_FACELETS' });
    expect(onResult).toHaveBeenCalledWith('Sync state');

    [...document.querySelectorAll<HTMLButtonElement>('#command-panel button')]
      .find((button) => button.textContent === 'Reboot cube')!
      .click();
    expect(confirm).toHaveBeenCalledOnce();
    expect(sendVendorCommand).not.toHaveBeenCalled();
  });
});
