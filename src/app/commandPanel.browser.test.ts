// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCommandPanel } from './commandPanel';

afterEach(() => document.body.replaceChildren());

describe('command panel', () => {
  it('places the supported destructive reset in Cube commands', async () => {
    document.body.innerHTML = '<section id="command-panel" hidden></section>';
    const sendCommand = vi.fn(async () => {});
    const confirm = vi.fn(() => true);
    const panel = createCommandPanel();

    panel.render(
      {
        gyroscope: false,
        battery: false,
        facelets: true,
        hardware: false,
        reset: true,
      },
      { sendCommand, sendVendorCommand: vi.fn(async () => {}), onResult: vi.fn(), confirm },
    );

    const button = [...document.querySelectorAll<HTMLButtonElement>('#command-panel button')].find(
      (candidate) => candidate.textContent === 'Reset state',
    );
    expect(button).toBeDefined();
    expect(document.querySelector('#command-panel')?.textContent).not.toContain('Sync state');

    button!.click();
    await Promise.resolve();
    expect(confirm).toHaveBeenCalledWith(
      "Reset the cube state? This clears the cube's stored state.",
    );
    expect(sendCommand).toHaveBeenCalledWith({ type: 'REQUEST_RESET' });
  });

  it('renders only supported controls and confirms reboot before sending it', async () => {
    document.body.innerHTML = '<section id="command-panel" hidden></section>';
    const calls: string[] = [];
    const sendCommand = vi.fn(async () => {
      calls.push('dispatch');
    });
    const sendVendorCommand = vi.fn(async () => {});
    const onBeforeSend = vi.fn(() => calls.push('before'));
    const onSend = vi.fn(() => calls.push('sent'));
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
      { sendCommand, sendVendorCommand, onBeforeSend, onSend, onResult, confirm },
    );

    expect(document.querySelector<HTMLElement>('#command-panel')?.hidden).toBe(false);
    expect(document.querySelector('#command-panel')?.textContent).toContain('Reset state');
    expect(document.querySelector('#command-panel')?.textContent).toContain('Toggle light');
    expect(document.querySelector('#command-panel')?.textContent).not.toContain('Calibrate gyro');

    [...document.querySelectorAll<HTMLButtonElement>('#command-panel button')]
      .find((button) => button.textContent === 'Refresh battery')!
      .click();
    await Promise.resolve();
    expect(sendCommand).toHaveBeenCalledWith({ type: 'REQUEST_BATTERY' });
    expect(onBeforeSend).toHaveBeenCalledWith({ type: 'REQUEST_BATTERY' });
    expect(onSend).toHaveBeenCalledWith('Refresh battery', { type: 'REQUEST_BATTERY' });
    expect(calls).toEqual(['before', 'sent', 'dispatch']);
    expect(onResult).toHaveBeenCalledWith('Refresh battery');

    [...document.querySelectorAll<HTMLButtonElement>('#command-panel button')]
      .find((button) => button.textContent === 'Reboot cube')!
      .click();
    expect(confirm).toHaveBeenCalledOnce();
    expect(sendVendorCommand).not.toHaveBeenCalled();
  });

  it('omits reset when the transport does not support it', () => {
    document.body.innerHTML = '<section id="command-panel" hidden></section>';
    const sendCommand = vi.fn(async () => {});
    const panel = createCommandPanel();

    panel.render(
      {
        gyroscope: false,
        battery: false,
        facelets: true,
        hardware: false,
        reset: false,
      },
      { sendCommand, sendVendorCommand: vi.fn(async () => {}), onResult: vi.fn() },
    );

    expect(document.querySelector('#command-panel')?.textContent).not.toContain('Reset state');
    expect(sendCommand).not.toHaveBeenCalled();
  });
});
