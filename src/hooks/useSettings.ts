/**
 * Settings state management hook
 *
 * This hook provides a bridge to the settingsStore for components that
 * need to manage application settings. It maintains backward compatibility
 * with the existing interface while using the centralized store.
 */

import { useState, useCallback, useEffect } from 'react';
import { useSettingsStore } from '../stores';
import type { AppSettings, SettingsSection } from '../types/settings';

interface UseSettingsReturn {
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  activeSection: SettingsSection;
  setActiveSection: (section: SettingsSection) => void;
  updateSettings: <K extends keyof AppSettings>(
    section: K,
    values: Partial<AppSettings[K]>
  ) => Promise<void>;
  resetSettings: () => Promise<void>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export function useSettings(): UseSettingsReturn {
  // Get state and actions from the store
  const settings = useSettingsStore((state) => state.settings);
  const loading = useSettingsStore((state) => state.loading);
  const error = useSettingsStore((state) => state.error);
  const saveStatus = useSettingsStore((state) => state.saveStatus);
  const storeUpdateSettings = useSettingsStore((state) => state.updateSettings);
  const storeResetSettings = useSettingsStore((state) => state.resetSettings);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  // Local state for active section (UI-only, doesn't need to be in store)
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  // Load settings on mount if not already loaded
  useEffect(() => {
    if (loading) {
      loadSettings();
    }
  }, [loading, loadSettings]);

  // Wrap store actions to maintain the same interface
  const updateSettings = useCallback(
    async <K extends keyof AppSettings>(section: K, values: Partial<AppSettings[K]>) => {
      await storeUpdateSettings(section, values);
    },
    [storeUpdateSettings]
  );

  const resetSettings = useCallback(async () => {
    await storeResetSettings();
  }, [storeResetSettings]);

  return {
    settings,
    loading,
    error,
    activeSection,
    setActiveSection,
    updateSettings,
    resetSettings,
    saveStatus,
  };
}
