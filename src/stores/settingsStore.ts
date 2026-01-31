/**
 * Settings Store - Manages application settings with Zustand
 *
 * This store handles:
 * - Application settings (general, model, shortcuts)
 * - Settings persistence (localStorage + Tauri backend)
 * - Theme management
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

import type { AppSettings, ThemeOption, ShortcutSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

// Constants
const SETTINGS_STORAGE_KEY = 'codex-desktop-settings';
const SETUP_COMPLETE_KEY = 'codex-desktop-setup-complete';
const THEME_ATTRIBUTE = 'data-theme';

// Types
interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  /** Whether the user has completed the initial setup (selected default model) */
  hasCompletedInitialSetup: boolean;
}

interface SettingsActions {
  loadSettings: () => Promise<void>;
  updateSettings: <K extends keyof AppSettings>(
    section: K,
    values: Partial<AppSettings[K]>
  ) => Promise<void>;
  updateShortcuts: (shortcuts: Partial<ShortcutSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  applyTheme: (theme: ThemeOption) => void;
  /** Mark the initial setup as complete (user has selected default model) */
  markSetupComplete: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;

// Helper functions
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDOM(themeOption: ThemeOption) {
  const resolvedTheme = themeOption === 'system' ? getSystemTheme() : themeOption;
  document.documentElement.setAttribute(THEME_ATTRIBUTE, resolvedTheme);
}

// Initialize theme immediately on module load
function initializeTheme() {
  try {
    const localSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (localSettings) {
      const parsed = JSON.parse(localSettings) as AppSettings;
      if (parsed.general?.theme) {
        applyThemeToDOM(parsed.general.theme);
        return;
      }
    }
  } catch {
    // Fall through to default
  }
  applyThemeToDOM('system');
}

initializeTheme();

// Check if initial setup was completed
function checkSetupComplete(): boolean {
  try {
    return localStorage.getItem(SETUP_COMPLETE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Initial state
const initialState: SettingsState = {
  settings: DEFAULT_SETTINGS,
  loading: true,
  error: null,
  saveStatus: 'idle',
  hasCompletedInitialSetup: checkSetupComplete(),
};

// Create the store
export const useSettingsStore = create<SettingsStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      loadSettings: async () => {
        set({ loading: true, error: null });

        try {
          // Try to load from Tauri backend first
          const savedSettings = await invoke<AppSettings | null>('get_settings').catch(() => null);

          if (savedSettings) {
            const merged = { ...DEFAULT_SETTINGS, ...savedSettings };
            set({ settings: merged, loading: false });
            applyThemeToDOM(merged.general.theme);
          } else {
            // Fallback to localStorage
            const localSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (localSettings) {
              const parsed = JSON.parse(localSettings) as AppSettings;
              const merged = { ...DEFAULT_SETTINGS, ...parsed };
              set({ settings: merged, loading: false });
              applyThemeToDOM(merged.general.theme);
            } else {
              set({ loading: false });
            }
          }
        } catch (err) {
          console.error('Failed to load settings:', err);
          set({
            error: err instanceof Error ? err.message : 'Failed to load settings',
            loading: false,
          });
        }
      },

      updateSettings: async (section, values) => {
        const { settings } = get();

        const currentSectionValue = settings[section];
        const newSectionValue =
          typeof currentSectionValue === 'object' && currentSectionValue !== null
            ? { ...currentSectionValue, ...values }
            : values;

        const newSettings: AppSettings = {
          ...settings,
          [section]: newSectionValue,
        };

        set({ settings: newSettings, saveStatus: 'saving' });

        // Apply theme immediately if changed
        if (section === 'general' && 'theme' in values) {
          applyThemeToDOM(newSettings.general.theme);
        }

        try {
          // Try to save to Tauri backend
          await invoke('save_settings', { settings: newSettings }).catch(() => {
            // Fallback to localStorage
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
          });

          set({ saveStatus: 'saved' });
          setTimeout(() => set({ saveStatus: 'idle' }), 2000);
        } catch (err) {
          console.error('Failed to save settings:', err);
          set({
            error: err instanceof Error ? err.message : 'Failed to save settings',
            saveStatus: 'error',
          });
        }
      },

      updateShortcuts: async (shortcuts) => {
        const { updateSettings, settings } = get();
        await updateSettings('shortcuts', { ...settings.shortcuts, ...shortcuts });
      },

      resetSettings: async () => {
        set({ settings: DEFAULT_SETTINGS, saveStatus: 'saving' });
        applyThemeToDOM(DEFAULT_SETTINGS.general.theme);

        try {
          await invoke('save_settings', { settings: DEFAULT_SETTINGS }).catch(() => {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
          });

          set({ saveStatus: 'saved' });
          setTimeout(() => set({ saveStatus: 'idle' }), 2000);
        } catch (err) {
          console.error('Failed to reset settings:', err);
          set({
            error: err instanceof Error ? err.message : 'Failed to reset settings',
            saveStatus: 'error',
          });
        }
      },

      applyTheme: (theme) => {
        applyThemeToDOM(theme);
      },

      markSetupComplete: () => {
        try {
          localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
        } catch {
          // localStorage not available, ignore
        }
        set({ hasCompletedInitialSetup: true });
      },
    })),
    { name: 'SettingsStore', enabled: import.meta.env.DEV }
  )
);

// Selectors
export const useShortcuts = () => useSettingsStore((state) => state.settings.shortcuts);
export const useTheme = () => useSettingsStore((state) => state.settings.general.theme);
export const useSettingsLoading = () => useSettingsStore((state) => state.loading);
export const useSettingsError = () => useSettingsStore((state) => state.error);
export const useHasCompletedInitialSetup = () =>
  useSettingsStore((state) => state.hasCompletedInitialSetup);
export const useDefaultModelId = () =>
  useSettingsStore((state) => state.settings.model.defaultModel);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const { settings } = useSettingsStore.getState();
    if (settings.general.theme === 'system') {
      applyThemeToDOM('system');
    }
  });
}
