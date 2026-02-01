/**
 * Model Panel
 */

import { memo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelSettings as ModelSettingsType } from '../../../types/settings';
import type { ModelOption, ReasoningEffort } from '../../../types/options';
import { Button } from '../../ui/data-entry/Button';

import { ModelSelector } from '../../ui/data-entry/ModelSelector';
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
  availableModels?: ModelOption[];
  /** Handler to fetch models */
  onFetchModels?: () => void;
  /** Status of the model fetch operation */
  fetchStatus?: FetchStatus;
}

export const ModelPanel = memo(function ModelPanel({
  settings,
  onUpdate,
  availableModels = [],
  onFetchModels,
  fetchStatus,
}: ModelPanelProps) {
  const { t } = useTranslation();
  const autoFetchTriggeredRef = useRef(false);

  // Auto-fetch models on mount if list is empty and not already loading
  useEffect(() => {
    if (
      !autoFetchTriggeredRef.current &&
      availableModels.length === 0 &&
      onFetchModels &&
      !fetchStatus?.loading &&
      !fetchStatus?.lastUpdated
    ) {
      autoFetchTriggeredRef.current = true;
      onFetchModels();
    }
  }, [availableModels.length, onFetchModels, fetchStatus?.loading, fetchStatus?.lastUpdated]);

  // Check whether the selected model is still in the available list
  const isCurrentModelAvailable =
    availableModels.length === 0 ||
    availableModels.some((model) => model.value === settings.defaultModel);

  // Handle model and effort change
  const handleModelChange = useCallback(
    (modelId: string, effort?: ReasoningEffort) => {
      onUpdate({
        defaultModel: modelId,
        defaultReasoningEffort: effort,
      });
    },
    [onUpdate]
  );

  return (
    <div className="settings-section-content">
      <h2 className="settings-content__title">{t('settings.sections.model')}</h2>

      <ConfigEditor filename="config.toml" language="toml" />
      <ConfigEditor filename="auth.json" language="json" />

      <div style={{ marginBottom: '24px', padding: '0 4px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <label
            htmlFor="model-select"
            style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}
          >
            {t('settings.model.defaultModel')}
          </label>
          <Button
            className="settings-button"
            onClick={onFetchModels}
            disabled={fetchStatus?.loading}
            style={{ padding: '2px 8px', fontSize: '12px', height: '24px' }}
          >
            {fetchStatus?.loading ? t('settings.model.fetching') : t('settings.model.fetchModels')}
          </Button>
        </div>

        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            marginBottom: '12px',
            lineHeight: '1.5',
          }}
        >
          {t('settings.model.defaultModelDescription')}
        </p>

        {fetchStatus?.error && (
          <div className="settings-item__error" style={{ marginBottom: '8px' }}>
            {fetchStatus.error}
          </div>
        )}

        {fetchStatus?.loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span
              className="settings-loading__spinner"
              style={{ width: '12px', height: '12px', borderWidth: '2px' }}
            />
            <span>{t('settings.model.fetching')}</span>
          </div>
        ) : fetchStatus?.lastUpdated ? (
          <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--color-success)' }}>
            ✓{' '}
            {t('settings.model.fetchUpdated', {
              time: new Date(fetchStatus.lastUpdated).toLocaleTimeString(),
            })}
          </div>
        ) : null}

        {availableModels.length > 0 ? (
          <ModelSelector
            options={availableModels}
            selectedModel={isCurrentModelAvailable ? settings.defaultModel : undefined}
            selectedEffort={settings.defaultReasoningEffort}
            onChange={handleModelChange}
            size="md"
            aria-label={t('settings.model.defaultModel')}
          />
        ) : (
          <div className="settings-item__placeholder">
            <span className="settings-item__placeholder-icon">ℹ️</span>
            <span>{t('settings.model.noModelsAvailable')}</span>
          </div>
        )}
      </div>
    </div>
  );
});

ModelPanel.displayName = 'ModelPanel';
