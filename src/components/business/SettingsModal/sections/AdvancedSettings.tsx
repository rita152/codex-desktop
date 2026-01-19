/**
 * Advanced Settings Section
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdvancedSettings as AdvancedSettingsType, LogLevel, AppSettings } from '../../../../types/settings';
import { DEFAULT_SETTINGS } from '../../../../types/settings';

interface AdvancedSettingsProps {
    settings: AdvancedSettingsType;
    onUpdate: (values: Partial<AdvancedSettingsType>) => void;
    onReset: () => Promise<void>;
    onImportSettings?: (settings: AppSettings) => void;
    onExportSettings?: () => AppSettings | null;
}

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

function Toggle({ checked, onChange, disabled }: ToggleProps) {
    return (
        <button
            type="button"
            className={`settings-toggle ${checked ? 'settings-toggle--active' : ''}`}
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            role="switch"
            aria-checked={checked}
        >
            <span className="settings-toggle__knob" />
        </button>
    );
}

export function AdvancedSettings({ settings, onUpdate, onReset, onImportSettings, onExportSettings }: AdvancedSettingsProps) {
    const { t } = useTranslation();
    const [isResetting, setIsResetting] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [exportSuccess, setExportSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleReset = async () => {
        setIsResetting(true);
        try {
            await onReset();
            setShowResetConfirm(false);
        } finally {
            setIsResetting(false);
        }
    };

    const handleClearCache = async () => {
        try {
            // Clear localStorage cache
            localStorage.removeItem('codex-desktop-settings');
            localStorage.removeItem('codex-desktop-sessions');
            alert(t('settings.advanced.cacheClearedSuccess'));
        } catch (error) {
            console.error('Failed to clear cache:', error);
            alert(t('settings.advanced.cacheClearedError'));
        }
    };

    const handleExportSettings = () => {
        try {
            // Get current settings
            const settingsToExport = onExportSettings ? onExportSettings() : null;
            const exportData = settingsToExport || JSON.parse(
                localStorage.getItem('codex-desktop-settings') || JSON.stringify(DEFAULT_SETTINGS)
            );

            // Add export metadata
            const exportPayload = {
                ...exportData,
                exportedAt: new Date().toISOString(),
                exportVersion: '1.0',
            };

            // Create and download file
            const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `codex-desktop-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to export settings:', error);
            alert(t('settings.advanced.exportError'));
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportError(null);

        try {
            const text = await file.text();
            const importedData = JSON.parse(text);

            // Validate imported data structure
            if (!importedData || typeof importedData !== 'object') {
                throw new Error('Invalid settings file format');
            }

            // Check for required sections
            const requiredSections = ['general', 'model', 'approval', 'shortcuts', 'advanced'];
            const missingSections = requiredSections.filter(
                section => !(section in importedData)
            );

            if (missingSections.length > 0) {
                throw new Error(`Missing sections: ${missingSections.join(', ')}`);
            }

            // Merge with defaults to ensure all fields exist
            const mergedSettings: AppSettings = {
                general: { ...DEFAULT_SETTINGS.general, ...importedData.general },
                model: { ...DEFAULT_SETTINGS.model, ...importedData.model },
                approval: { ...DEFAULT_SETTINGS.approval, ...importedData.approval },
                shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...importedData.shortcuts },
                advanced: { ...DEFAULT_SETTINGS.advanced, ...importedData.advanced },
                version: importedData.version || DEFAULT_SETTINGS.version,
            };

            // Apply imported settings
            if (onImportSettings) {
                onImportSettings(mergedSettings);
            } else {
                localStorage.setItem('codex-desktop-settings', JSON.stringify(mergedSettings));
                // Reload to apply settings
                window.location.reload();
            }

            alert(t('settings.advanced.importSuccess'));
        } catch (error) {
            console.error('Failed to import settings:', error);
            setImportError(
                error instanceof Error
                    ? error.message
                    : t('settings.advanced.importError')
            );
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="settings-section-content">
            <h2 className="settings-content__title">{t('settings.sections.advanced')}</h2>

            {/* Developer Mode */}
            <div className="settings-item settings-item--row">
                <div>
                    <label className="settings-item__label">{t('settings.advanced.developerMode')}</label>
                    <p className="settings-item__description">{t('settings.advanced.developerModeDescription')}</p>
                </div>
                <div className="settings-item__control">
                    <Toggle
                        checked={settings.developerMode}
                        onChange={(checked) => onUpdate({ developerMode: checked })}
                    />
                </div>
            </div>

            {/* Log Level */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.advanced.logLevel')}</label>
                </div>
                <p className="settings-item__description">{t('settings.advanced.logLevelDescription')}</p>
                <select
                    className="settings-select"
                    value={settings.logLevel}
                    onChange={(e) => onUpdate({ logLevel: e.target.value as LogLevel })}
                >
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                </select>
            </div>

            {/* Max Session History */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.advanced.maxSessionHistory')}</label>
                </div>
                <p className="settings-item__description">{t('settings.advanced.maxSessionHistoryDescription')}</p>
                <input
                    type="number"
                    className="settings-input"
                    value={settings.maxSessionHistory}
                    onChange={(e) => onUpdate({ maxSessionHistory: parseInt(e.target.value) || 100 })}
                    min={10}
                    max={1000}
                    step={10}
                />
            </div>

            {/* Data Management */}
            <div className="settings-section">
                <h3 className="settings-section__title">{t('settings.advanced.dataManagement')}</h3>

                {/* Export Settings */}
                <div className="settings-item">
                    <div className="settings-item__header">
                        <label className="settings-item__label">{t('settings.advanced.exportSettings')}</label>
                    </div>
                    <p className="settings-item__description">{t('settings.advanced.exportSettingsDescription')}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        <button
                            type="button"
                            className="settings-button"
                            onClick={handleExportSettings}
                        >
                            📤 {t('settings.advanced.exportSettingsButton')}
                        </button>
                        {exportSuccess && (
                            <span style={{ color: 'var(--color-success)', fontSize: '13px' }}>
                                ✓ {t('settings.advanced.exportSuccess')}
                            </span>
                        )}
                    </div>
                </div>

                {/* Import Settings */}
                <div className="settings-item">
                    <div className="settings-item__header">
                        <label className="settings-item__label">{t('settings.advanced.importSettings')}</label>
                    </div>
                    <p className="settings-item__description">{t('settings.advanced.importSettingsDescription')}</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                    <button
                        type="button"
                        className="settings-button"
                        onClick={handleImportClick}
                    >
                        📥 {t('settings.advanced.importSettingsButton')}
                    </button>
                    {importError && (
                        <p className="settings-item__error">{importError}</p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="settings-section">
                <h3 className="settings-section__title">{t('settings.advanced.actions')}</h3>

                <div className="settings-item">
                    <div className="settings-item__header">
                        <label className="settings-item__label">{t('settings.advanced.clearCache')}</label>
                    </div>
                    <p className="settings-item__description">{t('settings.advanced.clearCacheDescription')}</p>
                    <button
                        type="button"
                        className="settings-button"
                        onClick={handleClearCache}
                    >
                        {t('settings.advanced.clearCacheButton')}
                    </button>
                </div>

                <div className="settings-item">
                    <div className="settings-item__header">
                        <label className="settings-item__label">{t('settings.advanced.resetSettings')}</label>
                    </div>
                    <p className="settings-item__description">{t('settings.advanced.resetSettingsDescription')}</p>

                    {showResetConfirm ? (
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: 'var(--color-warning)' }}>
                                {t('settings.advanced.resetConfirmMessage')}
                            </span>
                            <button
                                type="button"
                                className="settings-button settings-button--danger"
                                onClick={handleReset}
                                disabled={isResetting}
                            >
                                {isResetting ? t('settings.advanced.resetting') : t('settings.advanced.confirmReset')}
                            </button>
                            <button
                                type="button"
                                className="settings-button"
                                onClick={() => setShowResetConfirm(false)}
                                disabled={isResetting}
                            >
                                {t('settings.advanced.cancelReset')}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="settings-button settings-button--danger"
                            onClick={() => setShowResetConfirm(true)}
                        >
                            {t('settings.advanced.resetSettingsButton')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

