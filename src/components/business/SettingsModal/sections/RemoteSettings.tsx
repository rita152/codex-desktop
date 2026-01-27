/**
 * Remote Server Settings Section
 * Integrates existing RemoteServerManager component
 */

import { useTranslation } from 'react-i18next';
import { RemoteServerManager } from '../../RemoteServerManager';

export function RemoteSettings() {
  const { t } = useTranslation();

  return (
    <div className="settings-section-content">
      <h2 className="settings-content__title">{t('settings.sections.remote')}</h2>

      <p className="settings-item__description" style={{ marginBottom: 'var(--spacing-lg)' }}>
        {t('settings.remote.description')}
      </p>

      {/* Embed RemoteServerManager with custom styling for settings context */}
      <div className="settings-remote-manager">
        <RemoteServerManager />
      </div>
    </div>
  );
}
