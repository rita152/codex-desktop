/**
 * Advanced Settings Section
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdvancedSettings as AdvancedSettingsType, LogLevel } from '../../../../types/settings';

interface AdvancedSettingsProps {
    settings: AdvancedSettingsType;
    onUpdate: (values: Partial<AdvancedSettingsType>) => void;
    onReset: () => Promise<void>;
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

export function AdvancedSettings({ settings, onUpdate, onReset }: AdvancedSettingsProps) {
    const { t } = useTranslation();
    const [isResetting, setIsResetting] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

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
