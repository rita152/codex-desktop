import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRemoteServers } from '../../../hooks/useRemoteServers';
import { Button } from '../../ui/data-entry/Button';
import { Card } from '../../ui/data-display/Card';
import {
  ServerIcon,
  CheckIcon,
  CloseIcon,
} from '../../ui/data-display/Icon';
import './RemoteServerManager.css';

type RemoteServerManagerProps = {
  hideTitle?: boolean;
};

export function RemoteServerManager({ hideTitle = false }: RemoteServerManagerProps) {
  const { t } = useTranslation();
  const { servers, loading, error, testConnection } = useRemoteServers();
  const [testingServer, setTestingServer] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({});

  const handleTestConnection = async (serverId: string) => {
    setTestingServer(serverId);
    try {
      const result = await testConnection(serverId);
      setTestResults({ ...testResults, [serverId]: { success: true, message: result } });
    } catch (err) {
      setTestResults({
        ...testResults,
        [serverId]: {
          success: false,
          message: err instanceof Error ? err.message : t('settings.remoteServer.connectionFailed'),
        },
      });
    } finally {
      setTestingServer(null);
    }
  };

  return (
    <div className="remote-server-manager">
      {!hideTitle && (
        <div className="manager-header">
          <h2>{t('settings.remoteServer.title')}</h2>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {loading && servers.length === 0 ? (
        <div className="loading">{t('settings.remoteServer.loading')}</div>
      ) : servers.length === 0 ? (
        <div className="empty-state">
          <p>{t('settings.remoteServer.empty')}</p>
          <p className="hint">{t('settings.remoteServer.emptyHint')}</p>
        </div>
      ) : (
        <div className="servers-list">
          {servers.map((server) => (
            <Card
              key={server.id}
              className="server-card-item"
              radius="md"
              shadow={false}
              background="elevated"
              bordered
            >
              <div className="server-info-row">
                <div className="server-icon-wrapper">
                  <ServerIcon size={20} className="server-icon-visual" />
                </div>
                <div className="server-details-wrapper">
                  <h3 className="server-name">{server.name}</h3>
                  <p className="server-address">
                    {server.username}@{server.host}:{server.port}
                  </p>
                  <p className="server-auth-type">
                    {server.auth.type === 'agent'
                      ? t('settings.remoteServer.sshAgent')
                      : t('settings.remoteServer.sshKeyFile')}
                  </p>
                </div>
                <div className="server-actions-wrapper">
                  <Button
                    type="button"
                    onClick={() => handleTestConnection(server.id)}
                    disabled={testingServer === server.id}
                    className="test-connection-btn"
                  >
                    {testingServer === server.id
                      ? t('settings.remoteServer.testing')
                      : t('settings.remoteServer.testConnection')}
                  </Button>
                </div>
              </div>

              {testResults[server.id] && (
                <div className="test-result-row">
                  {testResults[server.id].success ? (
                    <CheckIcon size={16} className="result-icon success" />
                  ) : (
                    <CloseIcon size={16} className="result-icon error" />
                  )}
                  <span className={`result-message ${testResults[server.id].success ? 'success' : 'error'}`}>
                    {testResults[server.id].message}
                  </span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
