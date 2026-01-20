/**
 * Model Panel
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelSettings as ModelSettingsType, ApiProvider } from '../../../types/settings';
import type { SelectOption } from '../../ui/data-entry/Select/types';
import { Button } from '../../ui/data-entry/Button';
import { Input } from '../../ui/data-entry/Input';
import { NativeSelect } from '../../ui/data-entry/NativeSelect';

export interface ModelPanelProps {
    settings: ModelSettingsType;
    onUpdate: (values: Partial<ModelSettingsType>) => void;
    /** Dynamically fetched model list */
    availableModels?: SelectOption[];
}

export function ModelPanel({ settings, onUpdate, availableModels = [] }: ModelPanelProps) {
    const { t } = useTranslation();
    const [showApiKey, setShowApiKey] = useState(false);

    // Check whether the selected model is still in the available list
    const isCurrentModelAvailable = availableModels.length === 0 ||
        availableModels.some(model => model.value === settings.defaultModel);

    return (
        <div className="settings-section-content">
            <h2 className="settings-content__title">{t('settings.sections.model')}</h2>

            {/* Default Model */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.model.defaultModel')}</label>
                </div>
                <p className="settings-item__description">{t('settings.model.defaultModelDescription')}</p>
                {availableModels.length > 0 ? (
                    <NativeSelect
                        className="settings-select"
                        value={isCurrentModelAvailable ? settings.defaultModel : ''}
                        onChange={(e) => onUpdate({ defaultModel: e.target.value })}
                    >
                        {!isCurrentModelAvailable && (
                            <option value="" disabled>
                                {t('settings.model.selectModel')}
                            </option>
                        )}
                        {availableModels.map((model) => (
                            <option key={model.value} value={model.value}>
                                {model.label}
                            </option>
                        ))}
                    </NativeSelect>
                ) : (
                    <div className="settings-item__placeholder">
                        <span className="settings-item__placeholder-icon">ℹ️</span>
                        <span>{t('settings.model.noModelsAvailable')}</span>
                    </div>
                )}
            </div>

            {/* API Provider */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.model.apiProvider')}</label>
                </div>
                <p className="settings-item__description">{t('settings.model.apiProviderDescription')}</p>
                <NativeSelect
                    className="settings-select"
                    value={settings.apiProvider}
                    onChange={(e) => onUpdate({ apiProvider: e.target.value as ApiProvider })}
                >
                    <option value="openai">OpenAI</option>
                    <option value="azure">Azure OpenAI</option>
                    <option value="custom">{t('settings.model.customProvider')}</option>
                </NativeSelect>
            </div>

            {/* Custom API Base URL */}
            {settings.apiProvider === 'custom' && (
                <div className="settings-item">
                    <div className="settings-item__header">
                        <label className="settings-item__label">{t('settings.model.apiBaseUrl')}</label>
                    </div>
                    <p className="settings-item__description">{t('settings.model.apiBaseUrlDescription')}</p>
                    <Input
                        type="url"
                        className="settings-input"
                        value={settings.apiBaseUrl}
                        onChange={(e) => onUpdate({ apiBaseUrl: e.target.value })}
                        placeholder="https://api.example.com/v1"
                    />
                </div>
            )}

            {/* API Key */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.model.apiKey')}</label>
                </div>
                <p className="settings-item__description">{t('settings.model.apiKeyDescription')}</p>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <Input
                        type={showApiKey ? 'text' : 'password'}
                        className="settings-input settings-input--password"
                        value={settings.apiKey}
                        onChange={(e) => onUpdate({ apiKey: e.target.value })}
                        placeholder="sk-..."
                        style={{ flex: 1 }}
                    />
                    <Button
                        type="button"
                        className="settings-button"
                        onClick={() => setShowApiKey(!showApiKey)}
                    >
                        {showApiKey ? '🙈' : '👁️'}
                    </Button>
                </div>
            </div>

            {/* Max Tokens */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.model.maxTokens')}</label>
                </div>
                <p className="settings-item__description">{t('settings.model.maxTokensDescription')}</p>
                <Input
                    type="number"
                    className="settings-input"
                    value={settings.maxTokens}
                    onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value) || 8192 })}
                    min={1024}
                    max={128000}
                    step={1024}
                />
            </div>

            {/* Temperature */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.model.temperature')}</label>
                </div>
                <p className="settings-item__description">{t('settings.model.temperatureDescription')}</p>
                <div className="settings-slider-container">
                    <Input
                        type="range"
                        className="settings-slider"
                        value={settings.temperature}
                        onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
                        min={0}
                        max={2}
                        step={0.1}
                    />
                    <span className="settings-slider__value">{settings.temperature.toFixed(1)}</span>
                </div>
            </div>
        </div>
    );
}
