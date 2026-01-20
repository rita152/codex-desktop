/**
 * Approval Settings Section
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApprovalSettings as ApprovalSettingsType, ApprovalMode } from '../../../../types/settings';
import { Button } from '../../../ui/data-entry/Button';
import { Input } from '../../../ui/data-entry/Input';
import { NativeSelect } from '../../../ui/data-entry/NativeSelect';
import { Toggle } from '../../../ui/data-entry/Toggle';

interface ApprovalSettingsProps {
    settings: ApprovalSettingsType;
    onUpdate: (values: Partial<ApprovalSettingsType>) => void;
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
                <NativeSelect
                    className="settings-select"
                    value={settings.defaultMode}
                    onChange={(e) => onUpdate({ defaultMode: e.target.value as ApprovalMode })}
                >
                    <option value="all">{t('settings.approval.modeAll')}</option>
                    <option value="dangerous">{t('settings.approval.modeDangerous')}</option>
                    <option value="auto">{t('settings.approval.modeAuto')}</option>
                </NativeSelect>
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
                            <Button
                                type="button"
                                className="settings-list__item-remove"
                                onClick={() => handleRemoveCommand(command)}
                                aria-label={t('settings.approval.removeCommand')}
                            >
                                ✕
                            </Button>
                        </div>
                    ))}

                    <div className="settings-list__add">
                        <Input
                            type="text"
                            className="settings-input settings-list__add-input"
                            value={newCommand}
                            onChange={(e) => setNewCommand(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('settings.approval.addCommandPlaceholder')}
                        />
                        <Button
                            type="button"
                            className="settings-button settings-button--primary"
                            onClick={handleAddCommand}
                            disabled={!newCommand.trim()}
                        >
                            {t('settings.approval.addCommand')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
