// Remote Server Manager Component

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RemoteServerConfig, SshAuth } from '../../../types/remote';
import { useRemoteServers } from '../../../hooks/useRemoteServers';
import { Button } from '../../ui/data-entry/Button';
import { Input } from '../../ui/data-entry/Input';
import { NativeSelect } from '../../ui/data-entry/NativeSelect';
import './RemoteServerManager.css';

interface AddServerDialogProps {
    onClose: () => void;
    onAdd: (config: RemoteServerConfig) => Promise<void>;
}

function AddServerDialog({ onClose, onAdd }: AddServerDialogProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        name: '',
        host: '',
        port: 22,
        username: '',
        authType: 'agent' as 'agent' | 'key_file',
        privateKeyPath: '',
        passphrase: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.name || !formData.host || !formData.username) {
            setError(t('settings.remoteServer.fillRequired'));
            return;
        }

        const auth: SshAuth =
            formData.authType === 'agent'
                ? { type: 'agent' }
                : {
                    type: 'key_file',
                    privateKeyPath: formData.privateKeyPath,
                    passphrase: formData.passphrase || undefined,
                };

        const config: RemoteServerConfig = {
            id: `server-${Date.now()}`,
            name: formData.name,
            host: formData.host,
            port: formData.port,
            username: formData.username,
            auth,
        };

        try {
            setSubmitting(true);
            await onAdd(config);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('settings.remoteServer.failedToAdd'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="add-server-dialog">
            <div className="add-server-header">
                <h3>{t('settings.remoteServer.addTitle')}</h3>
                <Button
                    type="button"
                    className="dialog-close-button"
                    onClick={onClose}
                    aria-label={t('settings.remoteServer.close')}
                >
                    ✕
                </Button>
            </div>

            <form onSubmit={handleSubmit} className="server-form">
                {error && <div className="error-message">{error}</div>}

                <div className="form-group">
                    <label>{t('settings.remoteServer.serverNameRequired')}</label>
                    <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={t('settings.remoteServer.placeholder.serverName')}
                        required
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>{t('settings.remoteServer.hostRequired')}</label>
                        <Input
                            type="text"
                            value={formData.host}
                            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                            placeholder={t('settings.remoteServer.placeholder.host')}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('settings.remoteServer.port')}</label>
                        <Input
                            type="number"
                            value={formData.port}
                            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                            min={1}
                            max={65535}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>{t('settings.remoteServer.usernameRequired')}</label>
                    <Input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder={t('settings.remoteServer.placeholder.username')}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>{t('settings.remoteServer.authMethod')}</label>
                    <NativeSelect
                        value={formData.authType}
                        onChange={(e) =>
                            setFormData({ ...formData, authType: e.target.value as 'agent' | 'key_file' })
                        }
                    >
                        <option value="agent">{t('settings.remoteServer.sshAgent')}</option>
                        <option value="key_file">{t('settings.remoteServer.sshKeyFile')}</option>
                    </NativeSelect>
                </div>

                {formData.authType === 'key_file' && (
                    <>
                        <div className="form-group">
                            <label>{t('settings.remoteServer.privateKeyPath')}</label>
                            <Input
                                type="text"
                                value={formData.privateKeyPath}
                                onChange={(e) => setFormData({ ...formData, privateKeyPath: e.target.value })}
                                placeholder={t('settings.remoteServer.placeholder.privateKey')}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('settings.remoteServer.passphrase')}</label>
                            <Input
                                type="password"
                                value={formData.passphrase}
                                onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                                placeholder={t('settings.remoteServer.placeholder.passphrase')}
                            />
                        </div>
                    </>
                )}

                <div className="form-actions">
                    <Button type="button" onClick={onClose} disabled={submitting}>
                        {t('settings.remoteServer.cancel')}
                    </Button>
                    <Button type="submit" className="primary" disabled={submitting}>
                        {submitting ? t('settings.remoteServer.adding') : t('settings.remoteServer.addServer')}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export function RemoteServerManager() {
    const { t } = useTranslation();
    const { servers, loading, error, addServer, removeServer, testConnection } = useRemoteServers();
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [testingServer, setTestingServer] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

    const handleTestConnection = async (serverId: string) => {
        setTestingServer(serverId);
        try {
            const result = await testConnection(serverId);
            setTestResults({ ...testResults, [serverId]: { success: true, message: result } });
        } catch (err) {
            setTestResults({
                ...testResults,
                [serverId]: { success: false, message: err instanceof Error ? err.message : t('settings.remoteServer.connectionFailed') },
            });
        } finally {
            setTestingServer(null);
        }
    };

    const handleRemove = async (serverId: string) => {
        if (confirm(t('settings.remoteServer.removeConfirm'))) {
            await removeServer(serverId);
            const newResults = { ...testResults };
            delete newResults[serverId];
            setTestResults(newResults);
        }
    };

    return (
        <div className="remote-server-manager">
            <div className="manager-header">
                <h2>{t('settings.remoteServer.title')}</h2>
                <Button type="button" className="add-button" onClick={() => setShowAddDialog(true)}>
                    {t('settings.remoteServer.addServerShort')}
                </Button>
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
                                    {t('settings.remoteServer.authType')}: {server.auth.type === 'agent' ? t('settings.remoteServer.sshAgent') : t('settings.remoteServer.sshKeyFile')}
                                </p>
                            </div>

                            <div className="server-actions">
                                <Button
                                    type="button"
                                    onClick={() => handleTestConnection(server.id)}
                                    disabled={testingServer === server.id}
                                    className="test-button"
                                >
                                    {testingServer === server.id ? t('settings.remoteServer.testing') : t('settings.remoteServer.testConnection')}
                                </Button>
                                <Button type="button" onClick={() => handleRemove(server.id)} className="remove-button">
                                    {t('settings.remoteServer.remove')}
                                </Button>
                            </div>

                            {testResults[server.id] && (
                                <div className={`test-result ${testResults[server.id].success ? 'success' : 'error'}`}>
                                    {testResults[server.id].message}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showAddDialog && <AddServerDialog onClose={() => setShowAddDialog(false)} onAdd={addServer} />}
        </div>
    );
}
