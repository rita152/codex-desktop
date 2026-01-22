import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRemoteServers } from '../../../hooks/useRemoteServers';
import { Button } from '../../ui/data-entry/Button';
import './RemoteServerManager.css';

export function RemoteServerManager() {
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
      <div className="manager-header">
        <h2>{t('settings.remoteServer.title')}</h2>
      </div>

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
            <div key={server.id} className="server-card">
              <div className="server-info">
                <h3>{server.name}</h3>
                <p className="server-details">
                  {server.username}@{server.host}:{server.port}
                </p>
                <p className="auth-method">
                  {t('settings.remoteServer.authType')}:{' '}
                  {server.auth.type === 'agent'
                    ? t('settings.remoteServer.sshAgent')
                    : t('settings.remoteServer.sshKeyFile')}
                </p>
              </div>

              <div className="server-actions">
                <Button
                  type="button"
                  onClick={() => handleTestConnection(server.id)}
                  disabled={testingServer === server.id}
                  className="test-button"
                >
                  {testingServer === server.id
                    ? t('settings.remoteServer.testing')
                    : t('settings.remoteServer.testConnection')}
                </Button>
              </div>

              {testResults[server.id] && (
                <div
                  className={`test-result ${testResults[server.id].success ? 'success' : 'error'}`}
                >
                  {testResults[server.id].message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
