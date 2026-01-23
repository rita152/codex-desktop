
import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';
import { Button } from '../../ui/data-entry/Button';

export function ConfigEditor() {
    const [content, setContent] = useState('');
    const [configPath, setConfigPath] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');

    useEffect(() => {
        const updateTheme = () => {
            const dataTheme = document.documentElement.getAttribute('data-theme');
            if (dataTheme === 'dark') {
                setEditorTheme('vs-dark');
                return;
            }
            if (dataTheme === 'light') {
                setEditorTheme('light');
                return;
            }
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                setEditorTheme('vs-dark');
            } else {
                setEditorTheme('light');
            }
        };

        updateTheme();

        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => updateTheme();
        mediaQuery.addEventListener('change', handleChange);

        return () => {
            observer.disconnect();
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const home = await homeDir();
                const path = await join(home, '.codex', 'config.toml');
                setConfigPath(path);

                try {
                    const text = await readTextFile(path);
                    setContent(text);
                    setError(null);
                } catch (e) {
                    // File might not exist
                    console.error(e);
                    setError("Could not read config file (it might not exist).");
                    setContent("# .codex/config.toml\n");
                }
            } catch (err) {
                console.error('Failed to resolve path', err);
                setError('Failed to resolve config path.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        if (!configPath) return;
        setSaving(true);
        try {
            await writeTextFile(configPath, content);
            setError(null);
        } catch (err) {
            console.error('Failed to save', err);
            setError('Failed to save config file.');
        } finally {
            setSaving(false);
        }
    };

    const glassStyle = {
        background: editorTheme === 'vs-dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '12px',
        border: editorTheme === 'vs-dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
        padding: '16px',
        marginTop: '0px',
        marginBottom: '20px',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s ease',
    };

    const headerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        color: 'var(--text-primary)',
    }

    return (
        <div style={glassStyle}>
            <div style={headerStyle}>
                <span style={{ fontWeight: 600 }}>~/.codex/config.toml</span>
                <Button
                    onClick={handleSave}
                    disabled={loading || saving}
                    className="settings-button"
                    style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        backgroundColor: editorTheme === 'vs-dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--text-primary)'
                    }}
                >
                    {saving ? 'Saving...' : 'Save Config'}
                </Button>
            </div>

            {error && <div style={{ color: 'var(--status-error)', marginBottom: '8px', fontSize: '12px' }}>{error}</div>}

            <div style={{ height: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <Editor
                    height="100%"
                    defaultLanguage="toml"
                    value={content}
                    onChange={(value) => setContent(value || '')}
                    theme={editorTheme}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        padding: { top: 10, bottom: 10 },
                        // Make transparent background for editor (requires vs-dark theme tweaking usually, 
                        // but we can just let it be opaque inside the glass container for functionality)
                    }}
                />
            </div>
        </div>
    );
}
