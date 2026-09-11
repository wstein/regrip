// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCommandPanel } from './commandPanel';

afterEach(() => document.body.replaceChildren());

describe('command panel', () => {
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
    expect(document.querySelector('#command-panel')?.textContent).toContain('Sync state');
    expect(document.querySelector('#command-panel')?.textContent).toContain('Toggle light');
    expect(document.querySelector('#command-panel')?.textContent).not.toContain('Calibrate gyro');

    document.querySelector<HTMLButtonElement>('#command-panel button')!.click();
    await Promise.resolve();
    expect(sendCommand).toHaveBeenCalledWith({ type: 'REQUEST_FACELETS' });
    expect(onBeforeSend).toHaveBeenCalledWith({ type: 'REQUEST_FACELETS' });
    expect(onSend).toHaveBeenCalledWith('Sync state', { type: 'REQUEST_FACELETS' });
    expect(calls).toEqual(['before', 'sent', 'dispatch']);
    expect(onResult).toHaveBeenCalledWith('Sync state');

    [...document.querySelectorAll<HTMLButtonElement>('#command-panel button')]
      .find((button) => button.textContent === 'Reboot cube')!
      .click();
    expect(confirm).toHaveBeenCalledOnce();
    expect(sendVendorCommand).not.toHaveBeenCalled();
  });

  it('uses the snapshot-confirming sync operation for Sync state', async () => {
    document.body.innerHTML = '<section id="command-panel" hidden></section>';
    const sendCommand = vi.fn(async () => {});
    const syncState = vi.fn(async () => {});
    const panel = createCommandPanel();

    panel.render(
      {
        gyroscope: false,
        battery: false,
        facelets: true,
        hardware: false,
        reset: false,
      },
      { sendCommand, sendVendorCommand: vi.fn(async () => {}), syncState, onResult: vi.fn() },
    );

    document.querySelector<HTMLButtonElement>('#command-panel button')!.click();
    await Promise.resolve();
    expect(syncState).toHaveBeenCalledOnce();
    expect(sendCommand).not.toHaveBeenCalled();
  });
});
