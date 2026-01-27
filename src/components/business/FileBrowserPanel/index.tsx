import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';

import { isRemotePath, parseRemotePath } from '../../../utils/remotePath';
import type { RemoteFilesystemListing } from '../../../types/remote';

import { FolderIcon, CodeIcon, ChevronDownIcon } from '../../ui/data-display/Icon';

import { cn } from '../../../utils/cn';
import { listLocalDirectory } from '../../../api/filesystem';
import type { LocalDirectoryEntry } from '../../../api/filesystem';

import './FileBrowserPanel.css';

type FileBrowserPanelProps = {
  visible?: boolean;
  cwd: string;
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

type DirectoryLoadResult = {
  resolvedPath: string;
  entries: LocalDirectoryEntry[];
};

type VisibleItem =
  | {
      type: 'entry';
      entry: LocalDirectoryEntry;
      depth: number;
      isExpanded: boolean;
    }
  | {
      type: 'status';
      status: 'loading' | 'empty' | 'error';
      message: string;
      depth: number;
    };

export function FileBrowserPanel({
  visible = false,
  cwd,
  onResizeStart,
  onFileSelect,
  onDirectorySelect,
}: FileBrowserPanelProps) {
  const { t } = useTranslation();
  const [rootPath, setRootPath] = useState(cwd);
  const [rootEntries, setRootEntries] = useState<LocalDirectoryEntry[]>([]);
  const [entriesByPath, setEntriesByPath] = useState<Record<string, LocalDirectoryEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());
  const [loadingRoot, setLoadingRoot] = useState(false);
  const [errorRoot, setErrorRoot] = useState<string | null>(null);
  const [errorPaths, setErrorPaths] = useState<Record<string, string>>({});

  const fetchDirectoryEntries = useCallback(async (path: string): Promise<DirectoryLoadResult> => {
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

      return { resolvedPath, entries: mappedEntries };
    }

    const result = await listLocalDirectory(path);
    return { resolvedPath: result.path, entries: result.entries };
  }, []);

  const loadRootDirectory = useCallback(
    async (path: string) => {
      setLoadingRoot(true);
      setErrorRoot(null);
      setLoadingPaths(new Set());
      setEntriesByPath({});
      setExpandedPaths(new Set());
      setErrorPaths({});
      try {
        const result = await fetchDirectoryEntries(path);
        setRootPath(result.resolvedPath);
        setRootEntries(result.entries);
      } catch (err) {
        setErrorRoot(err instanceof Error ? err.message : String(err));
        setRootEntries([]);
      } finally {
        setLoadingRoot(false);
      }
    },
    [fetchDirectoryEntries]
  );

  useEffect(() => {
    if (visible && cwd) {
      void loadRootDirectory(cwd);
    }
  }, [visible, cwd, loadRootDirectory]);

  const handleNavigateUp = useCallback(() => {
    if (isRemotePath(rootPath)) {
      const { serverId, path } = parseRemotePath(rootPath);
      if (!serverId || !path || path === '/') return;
      // Simple string manipulation for now to go up
      // path is like /home/user. parent is /home
      const parent = path.replace(/\/$/, '').split('/').slice(0, -1).join('/') || '/';
      void loadRootDirectory(`remote://${serverId}${parent}`);
    } else {
      const parent = getParentPath(rootPath);
      if (parent) {
        void loadRootDirectory(parent);
      }
    }
  }, [rootPath, loadRootDirectory]);

  const handleItemClick = useCallback(
    (entry: LocalDirectoryEntry) => {
      if (entry.is_dir) {
        onDirectorySelect?.(entry.path);
        const shouldExpand = !expandedPaths.has(entry.path);
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          if (shouldExpand) {
            next.add(entry.path);
          } else {
            next.delete(entry.path);
          }
          return next;
        });
        if (!shouldExpand) return;
        if (entriesByPath[entry.path] || loadingPaths.has(entry.path)) return;
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.add(entry.path);
          return next;
        });
        void fetchDirectoryEntries(entry.path)
          .then((result) => {
            setEntriesByPath((prev) => ({ ...prev, [entry.path]: result.entries }));
            setErrorPaths((prev) => {
              const { [entry.path]: _ignored, ...rest } = prev;
              return rest;
            });
          })
          .catch((err) => {
            setErrorPaths((prev) => ({
              ...prev,
              [entry.path]: err instanceof Error ? err.message : String(err),
            }));
          })
          .finally(() => {
            setLoadingPaths((prev) => {
              const next = new Set(prev);
              next.delete(entry.path);
              return next;
            });
          });
      } else {
        onFileSelect?.(entry.path);
      }
    },
    [
      entriesByPath,
      expandedPaths,
      fetchDirectoryEntries,
      loadingPaths,
      onDirectorySelect,
      onFileSelect,
    ]
  );

  const canNavigateUp = isRemotePath(rootPath) ? rootPath.split('/').length > 3 : rootPath !== '/';

  const visibleItems = useMemo<VisibleItem[]>(() => {
    const items: VisibleItem[] = [];
    const walk = (entries: LocalDirectoryEntry[], depth: number) => {
      entries.forEach((entry) => {
        const isExpanded = entry.is_dir && expandedPaths.has(entry.path);
        items.push({ type: 'entry', entry, depth, isExpanded });
        if (!entry.is_dir || !isExpanded) return;

        if (loadingPaths.has(entry.path)) {
          items.push({
            type: 'status',
            status: 'loading',
            message: t('fileBrowser.loading'),
            depth: depth + 1,
          });
          return;
        }

        const errorMessage = errorPaths[entry.path];
        if (errorMessage) {
          items.push({
            type: 'status',
            status: 'error',
            message: errorMessage,
            depth: depth + 1,
          });
          return;
        }

        const children = entriesByPath[entry.path];
        if (!children) {
          items.push({
            type: 'status',
            status: 'loading',
            message: t('fileBrowser.loading'),
            depth: depth + 1,
          });
          return;
        }

        if (children.length === 0) {
          items.push({
            type: 'status',
            status: 'empty',
            message: t('fileBrowser.empty'),
            depth: depth + 1,
          });
          return;
        }

        walk(children, depth + 1);
      });
    };

    walk(rootEntries, 0);
    return items;
  }, [entriesByPath, errorPaths, expandedPaths, loadingPaths, rootEntries, t]);

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

      <div className="file-browser-panel__body">
        <div className="file-browser-panel__list">
          {canNavigateUp && (
            <button
              type="button"
              className="file-browser-panel__item file-browser-panel__item--up"
              onClick={handleNavigateUp}
              title={t('fileBrowser.navigateUp')}
            >
              <span className="file-browser-panel__item-icon" />
              <span className="file-browser-panel__item-name">...</span>
            </button>
          )}
          {loadingRoot && (
            <div className="file-browser-panel__loading">{t('fileBrowser.loading')}</div>
          )}
          {errorRoot && <div className="file-browser-panel__error">{errorRoot}</div>}
          {!loadingRoot && !errorRoot && rootEntries.length === 0 && (
            <div className="file-browser-panel__empty">{t('fileBrowser.empty')}</div>
          )}
          {!loadingRoot &&
            !errorRoot &&
            visibleItems.map((item, index) => {
              if (item.type === 'status') {
                return (
                  <div
                    key={`status-${index}`}
                    className={cn(
                      'file-browser-panel__item',
                      'file-browser-panel__item--status',
                      `file-browser-panel__item--${item.status}`
                    )}
                    style={{
                      paddingLeft: `calc(var(--spacing-md) + ${item.depth * 14}px)`,
                    }}
                  >
                    <span className="file-browser-panel__item-name">{item.message}</span>
                  </div>
                );
              }

              const { entry, depth, isExpanded } = item;
              return (
                <button
                  key={entry.path}
                  type="button"
                  className={cn(
                    'file-browser-panel__item',
                    entry.is_dir && 'file-browser-panel__item--dir'
                  )}
                  onClick={() => handleItemClick(entry)}
                  title={entry.path}
                  style={{
                    paddingLeft: `calc(var(--spacing-md) + ${depth * 14}px)`,
                  }}
                >
                  <span
                    className={cn(
                      'file-browser-panel__disclosure',
                      entry.is_dir
                        ? !isExpanded && 'file-browser-panel__disclosure--collapsed'
                        : 'file-browser-panel__disclosure--placeholder'
                    )}
                  >
                    {entry.is_dir && <ChevronDownIcon size={12} />}
                  </span>
                  <span className="file-browser-panel__item-icon">
                    {entry.is_dir ? <FolderIcon size={14} /> : <CodeIcon size={14} />}
                  </span>
                  <span className="file-browser-panel__item-name">{entry.name}</span>
                  <span className="file-browser-panel__item-size">
                    {formatFileSize(entry.size)}
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </aside>
  );
}

export type { FileBrowserPanelProps };
