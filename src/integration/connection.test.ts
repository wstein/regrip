import { beforeEach, describe, expect, it, vi } from 'vitest';

import { connectSmartCube } from 'smartcube-web-bluetooth';
import { connectCube, macAddressProvider } from './connection';

vi.mock('smartcube-web-bluetooth', () => ({ connectSmartCube: vi.fn() }));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('cube connection adapter', () => {
  it('requests a manual address on fallback and when advertisements are unavailable', async () => {
    const prompt = vi.fn().mockReturnValue('AA:BB');
    vi.stubGlobal('prompt', prompt);

    await expect(macAddressProvider({ watchAdvertisements() {} } as never, true)).resolves.toBe(
      'AA:BB',
    );
    await expect(macAddressProvider({} as BluetoothDevice)).resolves.toBe('AA:BB');
    await expect(macAddressProvider({ watchAdvertisements() {} } as never)).resolves.toBeNull();
    expect(prompt).toHaveBeenCalledTimes(2);
  });

  it('connects with diagnostics and the shared address provider', async () => {
    const connection = { deviceName: 'Test cube' };
    vi.mocked(connectSmartCube).mockResolvedValue(connection as never);

    await expect(connectCube()).resolves.toBe(connection);
    expect(connectSmartCube).toHaveBeenCalledWith({
      macAddressProvider,
      diagnostics: true,
    });
  });
});
