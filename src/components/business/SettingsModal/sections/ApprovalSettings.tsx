/**
 * Approval Settings Section
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApprovalSettings as ApprovalSettingsType, ApprovalMode } from '../../../../types/settings';

interface ApprovalSettingsProps {
    settings: ApprovalSettingsType;
    onUpdate: (values: Partial<ApprovalSettingsType>) => void;
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

export function ApprovalSettings({ settings, onUpdate }: ApprovalSettingsProps) {
    const { t } = useTranslation();
    const [newCommand, setNewCommand] = useState('');

    const handleAddCommand = () => {
        if (newCommand.trim() && !settings.trustedCommands.includes(newCommand.trim())) {
            onUpdate({
                trustedCommands: [...settings.trustedCommands, newCommand.trim()],
            });
            setNewCommand('');
        }
    };

    const handleRemoveCommand = (command: string) => {
        onUpdate({
            trustedCommands: settings.trustedCommands.filter((c) => c !== command),
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCommand();
        }
    };

    return (
        <div className="settings-section-content">
            <h2 className="settings-content__title">{t('settings.sections.approval')}</h2>

            {/* Default Mode */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.approval.defaultMode')}</label>
                </div>
                <p className="settings-item__description">{t('settings.approval.defaultModeDescription')}</p>
                <select
                    className="settings-select"
                    value={settings.defaultMode}
                    onChange={(e) => onUpdate({ defaultMode: e.target.value as ApprovalMode })}
                >
                    <option value="all">{t('settings.approval.modeAll')}</option>
                    <option value="dangerous">{t('settings.approval.modeDangerous')}</option>
                    <option value="auto">{t('settings.approval.modeAuto')}</option>
                </select>
            </div>

            {/* Individual Toggles */}
            <div className="settings-section">
                <h3 className="settings-section__title">{t('settings.approval.operationSettings')}</h3>

                <div className="settings-item settings-item--row">
                    <div>
                        <label className="settings-item__label">{t('settings.approval.requireFileWrite')}</label>
                        <p className="settings-item__description">{t('settings.approval.requireFileWriteDescription')}</p>
                    </div>
                    <div className="settings-item__control">
                        <Toggle
                            checked={settings.requireFileWrite}
                            onChange={(checked) => onUpdate({ requireFileWrite: checked })}
                        />
                    </div>
                </div>

                <div className="settings-item settings-item--row">
                    <div>
                        <label className="settings-item__label">{t('settings.approval.requireCommand')}</label>
                        <p className="settings-item__description">{t('settings.approval.requireCommandDescription')}</p>
                    </div>
                    <div className="settings-item__control">
                        <Toggle
                            checked={settings.requireCommand}
                            onChange={(checked) => onUpdate({ requireCommand: checked })}
                        />
                    </div>
                </div>

                <div className="settings-item settings-item--row">
                    <div>
                        <label className="settings-item__label">{t('settings.approval.requireDelete')}</label>
                        <p className="settings-item__description">{t('settings.approval.requireDeleteDescription')}</p>
                    </div>
                    <div className="settings-item__control">
                        <Toggle
                            checked={settings.requireDelete}
                            onChange={(checked) => onUpdate({ requireDelete: checked })}
                        />
                    </div>
                </div>

                <div className="settings-item settings-item--row">
                    <div>
                        <label className="settings-item__label">{t('settings.approval.requireNetwork')}</label>
                        <p className="settings-item__description">{t('settings.approval.requireNetworkDescription')}</p>
                    </div>
                    <div className="settings-item__control">
                        <Toggle
                            checked={settings.requireNetwork}
                            onChange={(checked) => onUpdate({ requireNetwork: checked })}
                        />
                    </div>
                </div>
            </div>

            {/* Trusted Commands */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.approval.trustedCommands')}</label>
                </div>
                <p className="settings-item__description">{t('settings.approval.trustedCommandsDescription')}</p>

                <div className="settings-list">
                    {settings.trustedCommands.map((command) => (
                        <div key={command} className="settings-list__item">
                            <span className="settings-list__item-text">{command}</span>
                            <button
                                type="button"
                                className="settings-list__item-remove"
                                onClick={() => handleRemoveCommand(command)}
                                aria-label={t('settings.approval.removeCommand')}
                            >
                                ✕
                            </button>
                        </div>
                    ))}

                    <div className="settings-list__add">
                        <input
                            type="text"
                            className="settings-input settings-list__add-input"
                            value={newCommand}
                            onChange={(e) => setNewCommand(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('settings.approval.addCommandPlaceholder')}
                        />
                        <button
                            type="button"
                            className="settings-button settings-button--primary"
                            onClick={handleAddCommand}
                            disabled={!newCommand.trim()}
                        >
                            {t('settings.approval.addCommand')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
