/**
 * Model Settings Section
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelSettings as ModelSettingsType, ApiProvider } from '../../../../types/settings';

interface ModelSettingsProps {
    settings: ModelSettingsType;
    onUpdate: (values: Partial<ModelSettingsType>) => void;
}

export function ModelSettings({ settings, onUpdate }: ModelSettingsProps) {
    const { t } = useTranslation();
    const [showApiKey, setShowApiKey] = useState(false);

    return (
        <div className="settings-section-content">
            <h2 className="settings-content__title">{t('settings.sections.model')}</h2>

            {/* Default Model */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.model.defaultModel')}</label>
                </div>
                <p className="settings-item__description">{t('settings.model.defaultModelDescription')}</p>
                <select
                    className="settings-select"
                    value={settings.defaultModel}
                    onChange={(e) => onUpdate({ defaultModel: e.target.value })}
                >
                    <option value="gpt-5.2-codex">GPT-5.2 Codex</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                </select>
            </div>

            {/* API Provider */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.model.apiProvider')}</label>
                </div>
                <p className="settings-item__description">{t('settings.model.apiProviderDescription')}</p>
                <select
                    className="settings-select"
                    value={settings.apiProvider}
                    onChange={(e) => onUpdate({ apiProvider: e.target.value as ApiProvider })}
                >
                    <option value="openai">OpenAI</option>
                    <option value="azure">Azure OpenAI</option>
                    <option value="custom">{t('settings.model.customProvider')}</option>
                </select>
            </div>

            {/* Custom API Base URL */}
            {settings.apiProvider === 'custom' && (
                <div className="settings-item">
                    <div className="settings-item__header">
                        <label className="settings-item__label">{t('settings.model.apiBaseUrl')}</label>
                    </div>
                    <p className="settings-item__description">{t('settings.model.apiBaseUrlDescription')}</p>
                    <input
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
                    <input
                        type={showApiKey ? 'text' : 'password'}
                        className="settings-input settings-input--password"
                        value={settings.apiKey}
                        onChange={(e) => onUpdate({ apiKey: e.target.value })}
                        placeholder="sk-..."
                        style={{ flex: 1 }}
                    />
                    <button
                        type="button"
                        className="settings-button"
                        onClick={() => setShowApiKey(!showApiKey)}
                    >
                        {showApiKey ? '🙈' : '👁️'}
                    </button>
                </div>
            </div>

            {/* Max Tokens */}
            <div className="settings-item">
                <div className="settings-item__header">
                    <label className="settings-item__label">{t('settings.model.maxTokens')}</label>
                </div>
                <p className="settings-item__description">{t('settings.model.maxTokensDescription')}</p>
                <input
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
                    <input
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
