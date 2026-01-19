/**
 * Settings state management hook
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings, SettingsSection } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

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

// Local storage key for settings (fallback)
const SETTINGS_STORAGE_KEY = 'codex-desktop-settings';

export function useSettings(): UseSettingsReturn {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<SettingsSection>('general');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Load settings on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        setError(null);

        try {
            // Try to load from Tauri backend first
            const savedSettings = await invoke<AppSettings | null>('get_settings').catch(() => null);

            if (savedSettings) {
                setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
            } else {
                // Fallback to localStorage
                const localSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
                if (localSettings) {
                    const parsed = JSON.parse(localSettings) as AppSettings;
                    setSettings({ ...DEFAULT_SETTINGS, ...parsed });
                }
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
            setError(err instanceof Error ? err.message : 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async (newSettings: AppSettings) => {
        setSaveStatus('saving');

        try {
            // Try to save to Tauri backend
            await invoke('save_settings', { settings: newSettings }).catch(() => {
                // Fallback to localStorage
                localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
            });

            setSaveStatus('saved');

            // Reset status after a delay
            setTimeout(() => {
                setSaveStatus('idle');
            }, 2000);
        } catch (err) {
            console.error('Failed to save settings:', err);
            setSaveStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to save settings');
        }
    };

    const updateSettings = useCallback(async <K extends keyof AppSettings>(
        section: K,
        values: Partial<AppSettings[K]>
    ) => {
        const currentSectionValue = settings[section];
        const newSectionValue = typeof currentSectionValue === 'object' && currentSectionValue !== null
            ? { ...currentSectionValue, ...values }
            : values;

        const newSettings: AppSettings = {
            ...settings,
            [section]: newSectionValue,
        };

        setSettings(newSettings);
        await saveSettings(newSettings);
    }, [settings]);

    const resetSettings = useCallback(async () => {
        setSettings(DEFAULT_SETTINGS);
        await saveSettings(DEFAULT_SETTINGS);
    }, []);

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
