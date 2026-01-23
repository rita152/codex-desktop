/**
 * Model Panel
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelSettings as ModelSettingsType } from '../../../types/settings';
import type { CodexCliConfigInfo } from '../../../types/codex';
import type { SelectOption } from '../../ui/data-entry/Select/types';
import { Button } from '../../ui/data-entry/Button';
import { Input } from '../../ui/data-entry/Input';
import { NativeSelect } from '../../ui/data-entry/NativeSelect';
import { ConfigEditor } from './ConfigEditor';

export interface FetchStatus {
  loading: boolean;
  error?: string | null;
  lastUpdated?: number | null;
}

export interface ModelPanelProps {
  settings: ModelSettingsType;
  onUpdate: (values: Partial<ModelSettingsType>) => void;
  /** Dynamically fetched model list */
  availableModels?: SelectOption[];
  /** Configuration from environment/files (read-only) */
  config?: CodexCliConfigInfo;
  loadingConfig?: boolean;
  configError?: string;
  /** Handler to fetch models */
  onFetchModels?: () => void;
  /** Status of the model fetch operation */
  fetchStatus?: FetchStatus;
}

export function ModelPanel({
  settings,
  onUpdate,
  availableModels = [],
  config,
  loadingConfig = false,
  configError,
  onFetchModels,
  fetchStatus,
}: ModelPanelProps) {
  const { t } = useTranslation();
  const [showApiKey, setShowApiKey] = useState(false);

  // Check whether the selected model is still in the available list
  const isCurrentModelAvailable =
    availableModels.length === 0 ||
    availableModels.some((model) => model.value === settings.defaultModel);

  return (
    <div className="settings-section-content">
      <h2 className="settings-content__title">{t('settings.sections.model')}</h2>

      <div className="settings-item">
        <div className="settings-item__header">
          <span className="settings-item__label">{t('settings.model.configTitle')}</span>
        </div>
        <p className="settings-item__description">{t('settings.model.configDescription')}</p>
        {loadingConfig ? (
          <div className="settings-item__placeholder">
            <span className="settings-item__placeholder-icon">⏳</span>
            <span>{t('settings.model.configLoading')}</span>
          </div>
        ) : config?.configFound ? (
          <div className="settings-list">
            <div className="settings-list__item">
              <span className="settings-list__item-text">{t('settings.model.providerId')}</span>
              <span className="settings-list__item-text">{config.modelProvider ?? '-'}</span>
            </div>
            <div className="settings-list__item">
              <span className="settings-list__item-text">{t('settings.model.baseUrl')}</span>
              <span className="settings-list__item-text">{config.baseUrl ?? '-'}</span>
            </div>
            <div className="settings-list__item">
              <span className="settings-list__item-text">{t('settings.model.envKey')}</span>
              <span className="settings-list__item-text">{config.envKey ?? '-'}</span>
            </div>
            <div className="settings-list__item">
              <span className="settings-list__item-text">{t('settings.model.configPath')}</span>
              <span className="settings-list__item-text">{config.configPath}</span>
            </div>
            <div className="settings-list__item">
              <span className="settings-list__item-text">{t('settings.model.authFile')}</span>
              <span className="settings-list__item-text">
                {config.authFileFound
                  ? t('settings.model.authFileFound')
                  : t('settings.model.authFileMissing')}
              </span>
            </div>
          </div>
        ) : (
          <div className="settings-item__placeholder">
            <span className="settings-item__placeholder-icon">ℹ️</span>
            <span>{t('settings.model.configMissing')}</span>
          </div>
        )}
        {configError && <div className="settings-item__error">{configError}</div>}
      </div>

      <div className="settings-item">
        <div className="settings-item__header">
          <label htmlFor="model-select" className="settings-item__label">
            {t('settings.model.defaultModel')}
          </label>
          <div className="settings-item__control">
            <Button
              className="settings-button settings-button--primary"
              onClick={onFetchModels}
              disabled={fetchStatus?.loading}
            >
              {fetchStatus?.loading
                ? t('settings.model.fetching')
                : t('settings.model.fetchModels')}
            </Button>
          </div>
        </div>
        <p className="settings-item__description">{t('settings.model.defaultModelDescription')}</p>
        {fetchStatus?.error && <div className="settings-item__error">{fetchStatus.error}</div>}
        {fetchStatus?.loading ? (
          <span className="settings-modal__status settings-modal__status--saving">
            {t('settings.model.fetching')}
          </span>
        ) : fetchStatus?.lastUpdated ? (
          <span className="settings-modal__status settings-modal__status--saved">
            {t('settings.model.fetchUpdated', {
              time: new Date(fetchStatus.lastUpdated).toLocaleTimeString(),
            })}
          </span>
        ) : null}

        {availableModels.length > 0 ? (
          <NativeSelect
            id="model-select"
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

      <div className="settings-item">
        <div className="settings-item__header">
          <label htmlFor="api-key-input" className="settings-item__label">
            {t('settings.model.apiKey')}
          </label>
        </div>
        <p className="settings-item__description">{t('settings.model.apiKeyDescription')}</p>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <Input
            id="api-key-input"
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

      <ConfigEditor />
    </div>
  );
}
