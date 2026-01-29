/**
 * Model Panel
 */

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelSettings as ModelSettingsType } from '../../../types/settings';
import type { SelectOption } from '../../ui/data-entry/Select/types';
import { Button } from '../../ui/data-entry/Button';

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

  // Check whether the selected model is still in the available list
  const isCurrentModelAvailable =
    availableModels.length === 0 ||
    availableModels.some((model) => model.value === settings.defaultModel);

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
          <NativeSelect
            id="model-select"
            className="settings-select"
            value={isCurrentModelAvailable ? settings.defaultModel : ''}
            onChange={(e) => onUpdate({ defaultModel: e.target.value })}
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
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
    </div>
  );
});

ModelPanel.displayName = 'ModelPanel';
