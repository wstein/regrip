import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'regrip-color-scheme';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

async function freshModule() {
  return import('./colorSchemePreference');
}

describe('color scheme preference', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('defaults to the Western scheme when nothing is stored', async () => {
    const { getColorScheme } = await freshModule();
    expect(getColorScheme()).toBe('western');
  });

  it('persists a selected scheme and reloads it on the next session', async () => {
    const { getColorScheme, setColorScheme } = await freshModule();
    setColorScheme('japanese');
    expect(getColorScheme()).toBe('japanese');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('japanese');

    const { getColorScheme: getColorSchemeAgain } = await freshModule();
    expect(getColorSchemeAgain()).toBe('japanese');
  });

  it('falls back to Western for an unrecognized stored value', async () => {
    localStorage.setItem(STORAGE_KEY, 'mirrored');
    const { getColorScheme } = await freshModule();
    expect(getColorScheme()).toBe('western');
  });

  it('tolerates a localStorage that throws (private browsing, quota)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const { getColorScheme, setColorScheme } = await freshModule();
    expect(getColorScheme()).toBe('western');
    expect(() => setColorScheme('japanese')).not.toThrow();
    expect(getColorScheme()).toBe('japanese');
  });
});
