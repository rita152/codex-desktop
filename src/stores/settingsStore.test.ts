// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

type MockMediaQueryList = {
  matches: boolean;
  addEventListener: (type: 'change', listener: () => void) => void;
};

describe('SettingsStore', () => {
  let prefersDark = false;
  let onMediaChange: (() => void) | undefined;

  function installMatchMediaMock() {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((): MockMediaQueryList => {
        return {
          matches: prefersDark,
          addEventListener: (_type, listener) => {
            onMediaChange = listener;
          },
        };
      }),
    });
  }

  async function importFreshStoreModule() {
    vi.resetModules();
    installMatchMediaMock();
    // Re-import to exercise module-load side effects (theme init + media listener)
    return await import('./settingsStore');
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    onMediaChange = undefined;
    prefersDark = false;
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('initializes theme from localStorage on module load', async () => {
    const stored: AppSettings = {
      ...DEFAULT_SETTINGS,
      general: { ...DEFAULT_SETTINGS.general, theme: 'dark' },
    };
    localStorage.setItem('codex-desktop-settings', JSON.stringify(stored));

    await importFreshStoreModule();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('falls back to system theme when localStorage is invalid', async () => {
    localStorage.setItem('codex-desktop-settings', '{not-json');
    prefersDark = false;

    await importFreshStoreModule();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('loadSettings prefers backend settings and applies theme', async () => {
    const { useSettingsStore } = await importFreshStoreModule();
    (invoke as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_settings') {
        return {
          ...DEFAULT_SETTINGS,
          general: { ...DEFAULT_SETTINGS.general, theme: 'light' },
        } satisfies AppSettings;
      }
      return null;
    });

    await act(async () => {
      await useSettingsStore.getState().loadSettings();
    });

    expect(useSettingsStore.getState().loading).toBe(false);
    expect(useSettingsStore.getState().settings.general.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('loadSettings falls back to localStorage when backend returns null', async () => {
    const stored: AppSettings = {
      ...DEFAULT_SETTINGS,
      general: { ...DEFAULT_SETTINGS.general, theme: 'dark' },
    };
    localStorage.setItem('codex-desktop-settings', JSON.stringify(stored));

    const { useSettingsStore } = await importFreshStoreModule();
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await act(async () => {
      await useSettingsStore.getState().loadSettings();
    });

    expect(useSettingsStore.getState().settings.general.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('updateSettings saves via backend and resets saveStatus after timeout', async () => {
    const { useSettingsStore, useTheme, useSettingsLoading } = await importFreshStoreModule();
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await act(async () => {
      await useSettingsStore.getState().updateSettings('general', { theme: 'dark' });
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(useSettingsStore.getState().saveStatus).toBe('saved');

    // selectors (hooks)
    const themeHook = renderHook(() => useTheme());
    expect(themeHook.result.current).toBe('dark');
    const loadingHook = renderHook(() => useSettingsLoading());
    expect(loadingHook.result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(useSettingsStore.getState().saveStatus).toBe('idle');
  });

  it('updateSettings falls back to localStorage when backend save fails', async () => {
    const { useSettingsStore } = await importFreshStoreModule();

    (invoke as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
      if (cmd === 'save_settings') {
        throw new Error('no backend');
      }
      return null;
    });

    await act(async () => {
      await useSettingsStore.getState().updateSettings('general', { theme: 'dark' });
    });

    expect(localStorage.getItem('codex-desktop-settings')).toContain('"theme":"dark"');
    expect(useSettingsStore.getState().saveStatus).toBe('saved');
  });

  it('updateSettings reports error when fallback persistence fails', async () => {
    const { useSettingsStore } = await importFreshStoreModule();
    const originalSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('disk full');
    });

    (invoke as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
      if (cmd === 'save_settings') {
        throw new Error('no backend');
      }
      return null;
    });

    await act(async () => {
      await useSettingsStore.getState().updateSettings('general', { theme: 'dark' });
    });

    expect(useSettingsStore.getState().saveStatus).toBe('error');
    expect(useSettingsStore.getState().error).toBe('disk full');
    localStorage.setItem = originalSetItem;
  });

  it('updateShortcuts merges into existing shortcuts', async () => {
    const { useSettingsStore } = await importFreshStoreModule();
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await act(async () => {
      await useSettingsStore.getState().updateShortcuts({ sendMessage: 'Ctrl+Enter' });
    });

    expect(useSettingsStore.getState().settings.shortcuts.sendMessage).toBe('Ctrl+Enter');
  });

  it('resetSettings applies default theme and persists', async () => {
    const { useSettingsStore } = await importFreshStoreModule();
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await act(async () => {
      await useSettingsStore.getState().updateSettings('general', { theme: 'dark' });
    });
    expect(useSettingsStore.getState().settings.general.theme).toBe('dark');

    await act(async () => {
      await useSettingsStore.getState().resetSettings();
    });

    expect(useSettingsStore.getState().settings.general.theme).toBe(DEFAULT_SETTINGS.general.theme);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('re-applies system theme on prefers-color-scheme changes when theme=system', async () => {
    const { useSettingsStore } = await importFreshStoreModule();
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await act(async () => {
      await useSettingsStore.getState().updateSettings('general', { theme: 'system' });
    });

    prefersDark = true;
    onMediaChange?.();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
