import { useCallback, useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';

import { isRemotePath, parseRemotePath } from '../../../utils/remotePath';
import type { RemoteFilesystemListing } from '../../../types/remote';

import { FolderIcon, CodeIcon, ChevronDownIcon } from '../../ui/data-display/Icon';
import { Button } from '../../ui/data-entry/Button';
import { cn } from '../../../utils/cn';
import { listLocalDirectory } from '../../../api/filesystem';
import type { LocalDirectoryEntry } from '../../../api/filesystem';

import './FileBrowserPanel.css';

type FileBrowserPanelProps = {
    visible?: boolean;
    cwd: string;
    onClose?: () => void;
    onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onFileSelect?: (path: string) => void;
    onDirectorySelect?: (path: string) => void;
};

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getParentPath(path: string): string | null {
    const normalized = path.replace(/\/$/, '');
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash <= 0) return '/';
    return normalized.substring(0, lastSlash);
}

export function FileBrowserPanel({
    visible = false,
    cwd,
    onClose,
    onResizeStart,
    onFileSelect,
    onDirectorySelect,
}: FileBrowserPanelProps) {
    const { t } = useTranslation();
    const [currentPath, setCurrentPath] = useState(cwd);
    const [entries, setEntries] = useState<LocalDirectoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDirectory = useCallback(async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            if (isRemotePath(path)) {
                const { serverId, path: remotePath } = parseRemotePath(path);
                if (!serverId) throw new Error('Invalid remote path');

                const result = await invoke<RemoteFilesystemListing>('remote_list_entries', {
                    serverId,
                    path: remotePath || '',
                });

                const prefix = `remote://${serverId}`;
                const resolvedPath = `${prefix}${result.path}`;

                const mappedEntries: LocalDirectoryEntry[] = result.entries.map((e) => ({
                    name: e.name,
                    path: `${prefix}${e.path}`,
                    is_dir: e.is_dir,
                    size: e.size,
                    modified: null,
                }));

                setEntries(mappedEntries);
                setCurrentPath(resolvedPath);
            } else {
                const result = await listLocalDirectory(path);
                setEntries(result.entries);
                setCurrentPath(result.path);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (visible && cwd) {
            void loadDirectory(cwd);
        }
    }, [visible, cwd, loadDirectory]);

    const handleRefresh = useCallback(() => {
        void loadDirectory(currentPath);
    }, [currentPath, loadDirectory]);

    const handleNavigateUp = useCallback(() => {
        if (isRemotePath(currentPath)) {
            const { serverId, path } = parseRemotePath(currentPath);
            if (!serverId || !path || path === '/') return;
            // Simple string manipulation for now to go up
            // path is like /home/user. parent is /home
            const parent = path.replace(/\/$/, '').split('/').slice(0, -1).join('/') || '/';
            void loadDirectory(`remote://${serverId}${parent}`);
        } else {
            const parent = getParentPath(currentPath);
            if (parent) {
                void loadDirectory(parent);
            }
        }
    }, [currentPath, loadDirectory]);

    const handleItemClick = useCallback(
        (entry: LocalDirectoryEntry) => {
            if (entry.is_dir) {
                void loadDirectory(entry.path);
                onDirectorySelect?.(entry.path);
            } else {
                onFileSelect?.(entry.path);
            }
        },
        [loadDirectory, onDirectorySelect, onFileSelect]
    );

    const canNavigateUp = currentPath !== '/' && !isRemotePath(currentPath) || (isRemotePath(currentPath) && currentPath.split('/').length > 3);

    return (
        <aside
            className={cn('file-browser-panel', !visible && 'file-browser-panel--hidden')}
            aria-hidden={!visible}
        >
            {visible && (
                <div
                    className="file-browser-panel__resize-handle"
                    role="separator"
                    aria-label={t('fileBrowser.resizePanel')}
                    aria-orientation="vertical"
                    onPointerDown={onResizeStart}
                    tabIndex={0}
                />
            )}
            <header className="file-browser-panel__header">
                <div className="file-browser-panel__title">
                    <FolderIcon size={16} />
                    <span>{t('fileBrowser.title')}</span>
                </div>
                <div className="file-browser-panel__actions">
                    <Button
                        type="button"
                        className="file-browser-panel__close"
                        onClick={onClose}
                        aria-label={t('fileBrowser.close')}
                    >
                        {t('fileBrowser.close')}
                    </Button>
                </div>
            </header>
            <div className="file-browser-panel__body">
                <div className="file-browser-panel__path-bar">
                    <button
                        type="button"
                        className="file-browser-panel__nav-btn"
                        onClick={handleNavigateUp}
                        disabled={!canNavigateUp}
                        aria-label={t('fileBrowser.navigateUp')}
                        title={t('fileBrowser.navigateUp')}
                    >
                        <ChevronDownIcon size={14} className="icon--rotate-90" />
                    </button>
                    <button
                        type="button"
                        className="file-browser-panel__nav-btn"
                        onClick={handleRefresh}
                        aria-label={t('fileBrowser.refresh')}
                        title={t('fileBrowser.refresh')}
                    >
                        ↻
                    </button>
                    <span className="file-browser-panel__path-text" title={currentPath}>
                        {currentPath}
                    </span>
                </div>
                <div className="file-browser-panel__list">
                    {loading && (
                        <div className="file-browser-panel__loading">
                            {t('fileBrowser.loading')}
                        </div>
                    )}
                    {error && (
                        <div className="file-browser-panel__error">
                            {error}
                        </div>
                    )}
                    {!loading && !error && entries.length === 0 && (
                        <div className="file-browser-panel__empty">
                            {t('fileBrowser.empty')}
                        </div>
                    )}
                    {!loading && !error && entries.map((entry) => (
                        <button
                            key={entry.path}
                            type="button"
                            className={cn(
                                'file-browser-panel__item',
                                entry.is_dir && 'file-browser-panel__item--dir'
                            )}
                            onClick={() => handleItemClick(entry)}
                            title={entry.path}
                        >
                            <span className="file-browser-panel__item-icon">
                                {entry.is_dir ? <FolderIcon size={14} /> : <CodeIcon size={14} />}
                            </span>
                            <span className="file-browser-panel__item-name">{entry.name}</span>
                            <span className="file-browser-panel__item-size">
                                {formatFileSize(entry.size)}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </aside>
    );
}

export type { FileBrowserPanelProps };
