// Remote Server Manager Component

import { useState } from 'react';
import { RemoteServerConfig, SshAuth } from '../../../types/remote';
import { useRemoteServers } from '../../../hooks/useRemoteServers';
import './RemoteServerManager.css';

interface AddServerDialogProps {
    onClose: () => void;
    onAdd: (config: RemoteServerConfig) => Promise<void>;
}

function AddServerDialog({ onClose, onAdd }: AddServerDialogProps) {
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
            setError('Please fill in all required fields');
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
            setError(err instanceof Error ? err.message : 'Failed to add server');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="add-server-dialog">
            <div className="add-server-header">
                <h3>Add Remote Server</h3>
                <button className="dialog-close-button" onClick={onClose}>
                    ✕
                </button>
            </div>

            <form onSubmit={handleSubmit} className="server-form">
                {error && <div className="error-message">{error}</div>}

                <div className="form-group">
                    <label>Server Name *</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My Server"
                        required
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Host *</label>
                        <input
                            type="text"
                            value={formData.host}
                            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                            placeholder="example.com"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Port</label>
                        <input
                            type="number"
                            value={formData.port}
                            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                            min={1}
                            max={65535}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Username *</label>
                    <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="user"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Authentication Method</label>
                    <select
                        value={formData.authType}
                        onChange={(e) =>
                            setFormData({ ...formData, authType: e.target.value as 'agent' | 'key_file' })
                        }
                    >
                        <option value="agent">SSH Agent (Recommended)</option>
                        <option value="key_file">SSH Key File</option>
                    </select>
                </div>

                {formData.authType === 'key_file' && (
                    <>
                        <div className="form-group">
                            <label>Private Key Path</label>
                            <input
                                type="text"
                                value={formData.privateKeyPath}
                                onChange={(e) => setFormData({ ...formData, privateKeyPath: e.target.value })}
                                placeholder="~/.ssh/id_rsa"
                            />
                        </div>
                        <div className="form-group">
                            <label>Passphrase (Optional)</label>
                            <input
                                type="password"
                                value={formData.passphrase}
                                onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                                placeholder="Leave empty if not required"
                            />
                        </div>
                    </>
                )}

                <div className="form-actions">
                    <button type="button" onClick={onClose} disabled={submitting}>
                        Cancel
                    </button>
                    <button type="submit" className="primary" disabled={submitting}>
                        {submitting ? 'Adding...' : 'Add Server'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export function RemoteServerManager() {
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
                [serverId]: { success: false, message: err instanceof Error ? err.message : 'Connection failed' },
            });
        } finally {
            setTestingServer(null);
        }
    };

    const handleRemove = async (serverId: string) => {
        if (confirm('Are you sure you want to remove this server?')) {
            await removeServer(serverId);
            const newResults = { ...testResults };
            delete newResults[serverId];
            setTestResults(newResults);
        }
    };

    return (
        <div className="remote-server-manager">
            <div className="manager-header">
                <h2>Remote Servers</h2>
                <button className="add-button" onClick={() => setShowAddDialog(true)}>
                    + Add Server
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {loading && servers.length === 0 ? (
                <div className="loading">Loading servers...</div>
            ) : servers.length === 0 ? (
                <div className="empty-state">
                    <p>No remote servers configured</p>
                    <p className="hint">Add a server to connect to remote development environments</p>
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
                                    Auth: {server.auth.type === 'agent' ? 'SSH Agent' : 'SSH Key'}
                                </p>
                            </div>

                            <div className="server-actions">
                                <button
                                    onClick={() => handleTestConnection(server.id)}
                                    disabled={testingServer === server.id}
                                    className="test-button"
                                >
                                    {testingServer === server.id ? 'Testing...' : 'Test Connection'}
                                </button>
                                <button onClick={() => handleRemove(server.id)} className="remove-button">
                                    Remove
                                </button>
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
