import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';

import { FolderIcon } from '../../ui/data-display/Icon';
import { Select } from '../../ui/data-entry/Select';
import { Button } from '../../ui/data-entry/Button';
import { Input } from '../../ui/data-entry/Input';
import { listRemoteDirectories } from '../../../api/remote';
import { cn } from '../../../utils/cn';
import { buildRemotePath, isRemotePath, parseRemotePath } from '../../../utils/remotePath';
import { formatError } from '../../../utils/codexParsing';
import { useRemoteServers } from '../../../hooks/useRemoteServers';

import type { RemoteDirectoryListing } from '../../../types/remote';

import './WorkingDirectorySelector.css';

type WorkingDirectorySelectorProps = {
  isOpen: boolean;
  currentCwd?: string;
  onClose: () => void;
  onSelect: (cwd: string) => void;
};

export function WorkingDirectorySelector({
  isOpen,
  currentCwd,
  onClose,
  onSelect,
}: WorkingDirectorySelectorProps) {
  const { t } = useTranslation();
  const { servers, loading, error, loadServers } = useRemoteServers();
  const [mode, setMode] = useState<'local' | 'remote'>('local');
  const [localPath, setLocalPath] = useState('');
  const [remoteServerId, setRemoteServerId] = useState('');
  const [remotePathInput, setRemotePathInput] = useState('');
  const [remotePathForListing, setRemotePathForListing] = useState('');
  const [remoteListing, setRemoteListing] = useState<RemoteDirectoryListing | null>(null);
  const [remoteListingError, setRemoteListingError] = useState<string | null>(null);
  const [remoteListingLoading, setRemoteListingLoading] = useState(false);
  const remoteRequestIdRef = useRef(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const serverOptions = useMemo(
    () =>
      servers.map((server) => ({
        value: server.id,
        label:
          server.port === 22
            ? `${server.name} (${server.username}@${server.host})`
            : `${server.name} (${server.username}@${server.host}:${server.port})`,
      })),
    [servers]
  );

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === remoteServerId),
    [remoteServerId, servers]
  );

  useEffect(() => {
    if (!isOpen) return;

    if (currentCwd && isRemotePath(currentCwd)) {
      const parsed = parseRemotePath(currentCwd);
      setMode('remote');
      setRemoteServerId(parsed.serverId ?? '');
      setRemotePathInput(parsed.path ?? '');
      setRemotePathForListing(parsed.path ?? '');
      setRemoteListing(null);
      setRemoteListingError(null);
      setLocalPath('');
    } else {
      setMode('local');
      setLocalPath(currentCwd ?? '');
      setRemoteServerId('');
      setRemotePathInput('');
      setRemotePathForListing('');
      setRemoteListing(null);
      setRemoteListingError(null);
    }
    setValidationError(null);
  }, [currentCwd, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    void loadServers();
  }, [isOpen, loadServers]);

  const handleBrowseLocal = async () => {
    try {
      const selection = await open({
        directory: true,
        multiple: false,
        defaultPath: localPath || undefined,
      });
      if (typeof selection === 'string') {
        setLocalPath(selection);
        setValidationError(null);
      } else if (Array.isArray(selection) && typeof selection[0] === 'string') {
        setLocalPath(selection[0]);
        setValidationError(null);
      }
    } catch (err) {
      setValidationError(t('errors.genericError', { error: formatError(err) }));
    }
  };

  const getParentPath = (value: string): string | null => {
    if (!value) return null;
    const trimmed = value.endsWith('/') && value.length > 1 ? value.slice(0, -1) : value;
    if (trimmed === '/' || trimmed === '') return null;
    const lastSlash = trimmed.lastIndexOf('/');
    if (lastSlash <= 0) return '/';
    return trimmed.slice(0, lastSlash);
  };

  const loadRemoteListing = useCallback(
    async (serverId: string, path: string) => {
      if (!serverId) return;
      const requestId = remoteRequestIdRef.current + 1;
      remoteRequestIdRef.current = requestId;
      setRemoteListingLoading(true);
      setRemoteListingError(null);
      try {
        const result = await listRemoteDirectories(serverId, path);
        if (remoteRequestIdRef.current !== requestId) return;
        setRemoteListing(result);
        setRemotePathInput(result.path);
        setRemoteListingError(null);
      } catch (err) {
        if (remoteRequestIdRef.current !== requestId) return;
        setRemoteListing(null);
        setRemoteListingError(t('errors.genericError', { error: formatError(err) }));
      } finally {
        if (remoteRequestIdRef.current === requestId) {
          setRemoteListingLoading(false);
        }
      }
    },
    [t]
  );

  useEffect(() => {
    if (!isOpen || mode !== 'remote') return;
    if (!remoteServerId) {
      setRemoteListing(null);
      setRemoteListingError(null);
      return;
    }
    void loadRemoteListing(remoteServerId, remotePathForListing);
  }, [isOpen, loadRemoteListing, mode, remotePathForListing, remoteServerId]);

  const handleApply = () => {
    setValidationError(null);
    if (mode === 'local') {
      const trimmed = localPath.trim();
      if (!trimmed) {
        setValidationError(t('cwdSelector.errors.localRequired'));
        return;
      }
      onSelect(trimmed);
      onClose();
      return;
    }

    const trimmedServerId = remoteServerId.trim();
    const trimmedPath = remotePathInput.trim();
    if (!trimmedServerId) {
      setValidationError(t('cwdSelector.errors.remoteServerRequired'));
      return;
    }
    if (!trimmedPath) {
      setValidationError(t('cwdSelector.errors.remotePathRequired'));
      return;
    }
    if (!trimmedPath.startsWith('/')) {
      setValidationError(t('cwdSelector.errors.remotePathAbsolute'));
      return;
    }

    onSelect(buildRemotePath(trimmedServerId, trimmedPath));
    onClose();
  };

  const handleRemotePathChange = (value: string) => {
    if (value.startsWith('remote://')) {
      const parsed = parseRemotePath(value);
      if (parsed.isRemote && parsed.serverId && parsed.path) {
        setRemoteServerId(parsed.serverId);
        setRemotePathInput(parsed.path);
        setRemotePathForListing(parsed.path);
        setRemoteListing(null);
        setRemoteListingError(null);
        setValidationError(null);
        return;
      }
    }
    setRemotePathInput(value);
  };

  const handleRemoteGo = () => {
    if (!remoteServerId) return;
    const target = remotePathInput.trim();
    setRemoteListingError(null);
    if (target === remotePathForListing) {
      void loadRemoteListing(remoteServerId, target);
      return;
    }
    setRemotePathForListing(target);
  };

  const handleRemoteEntryClick = (path: string) => {
    setRemotePathInput(path);
    setRemotePathForListing(path);
    setRemoteListingError(null);
    setValidationError(null);
  };

  const handleRemoteUp = () => {
    if (!remoteListing?.path) return;
    const parentPath = getParentPath(remoteListing.path);
    if (!parentPath) return;
    setRemotePathInput(parentPath);
    setRemotePathForListing(parentPath);
    setRemoteListingError(null);
  };

  const handleRemoteHome = () => {
    if (!remoteServerId) return;
    setRemotePathInput('');
    setRemotePathForListing('');
    setRemoteListingError(null);
  };

  const handleRemoteRefresh = () => {
    if (!remoteServerId) return;
    void loadRemoteListing(remoteServerId, remotePathForListing);
  };

  const remoteParentPath = remoteListing?.path ? getParentPath(remoteListing.path) : null;

  if (!isOpen) return null;

  return (
    <div className="cwd-selector" role="dialog" aria-modal="true" aria-labelledby="cwd-selector-title">
      <Button
        type="button"
        className="cwd-selector__backdrop"
        onClick={onClose}
        aria-label={t('cwdSelector.close')}
      />
      <div className="cwd-selector__panel" role="document">
        <header className="cwd-selector__header">
          <h2 id="cwd-selector-title">{t('cwdSelector.title')}</h2>
          <Button
            type="button"
            className="cwd-selector__close"
            onClick={onClose}
            aria-label={t('cwdSelector.close')}
          >
            x
          </Button>
        </header>

        <div className="cwd-selector__tabs" role="tablist" aria-label={t('cwdSelector.tabsLabel')}>
          <Button
            type="button"
            className={cn('cwd-selector__tab', mode === 'local' && 'cwd-selector__tab--active')}
            role="tab"
            aria-selected={mode === 'local'}
            onClick={() => {
              setMode('local');
              setValidationError(null);
            }}
          >
            {t('cwdSelector.localTab')}
          </Button>
          <Button
            type="button"
            className={cn('cwd-selector__tab', mode === 'remote' && 'cwd-selector__tab--active')}
            role="tab"
            aria-selected={mode === 'remote'}
            onClick={() => {
              setMode('remote');
              setValidationError(null);
            }}
          >
            {t('cwdSelector.remoteTab')}
          </Button>
        </div>

        <div className="cwd-selector__body">
          {validationError && <div className="cwd-selector__error">{validationError}</div>}
          {mode === 'remote' && error && <div className="cwd-selector__error">{error}</div>}

          {mode === 'local' ? (
            <div className="cwd-selector__section">
              <label className="cwd-selector__label" htmlFor="cwd-local-path">
                {t('cwdSelector.localPathLabel')}
              </label>
              <div className="cwd-selector__input-row">
                <Input
                  id="cwd-local-path"
                  type="text"
                  className="cwd-selector__input"
                  value={localPath}
                  onChange={(event) => {
                    setLocalPath(event.target.value);
                    setValidationError(null);
                  }}
                  placeholder={t('cwdSelector.localPathPlaceholder')}
                />
                <Button type="button" className="cwd-selector__button" onClick={handleBrowseLocal}>
                  {t('cwdSelector.localBrowse')}
                </Button>
              </div>
              <p className="cwd-selector__hint">{t('cwdSelector.localHint')}</p>
            </div>
          ) : (
            <div className="cwd-selector__section">
              <label className="cwd-selector__label" htmlFor="cwd-remote-server">
                {t('cwdSelector.remoteServerLabel')}
              </label>
              <Select
                id="cwd-remote-server"
                options={serverOptions}
                value={remoteServerId}
                onChange={(value) => {
                  setRemoteServerId(value);
                  setRemotePathInput('');
                  setRemotePathForListing('');
                  setRemoteListing(null);
                  setRemoteListingError(null);
                  setValidationError(null);
                }}
                width="100%"
                disabled={servers.length === 0}
                aria-label={t('cwdSelector.remoteServerLabel')}
              />
              {loading && servers.length === 0 && (
                <p className="cwd-selector__hint">{t('cwdSelector.loadingServers')}</p>
              )}
              {!loading && servers.length === 0 && (
                <p className="cwd-selector__hint">{t('cwdSelector.emptyRemoteServers')}</p>
              )}
              {selectedServer && (
                <p className="cwd-selector__meta">
                  {selectedServer.username}@{selectedServer.host}:{selectedServer.port}
                </p>
              )}

              <label className="cwd-selector__label" htmlFor="cwd-remote-path">
                {t('cwdSelector.remotePathLabel')}
              </label>
              <div className="cwd-selector__input-row">
                <Input
                  id="cwd-remote-path"
                  type="text"
                  className="cwd-selector__input"
                  value={remotePathInput}
                  onChange={(event) => {
                    handleRemotePathChange(event.target.value);
                    setValidationError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleRemoteGo();
                    }
                  }}
                  placeholder={t('cwdSelector.remotePathPlaceholder')}
                />
                <Button
                  type="button"
                  className="cwd-selector__button"
                  onClick={handleRemoteGo}
                  disabled={!remoteServerId || remoteListingLoading}
                >
                  {t('cwdSelector.remoteGo')}
                </Button>
              </div>
              <p className="cwd-selector__hint">{t('cwdSelector.remoteHint')}</p>

              <div className="cwd-selector__browser">
                <div className="cwd-selector__browser-header">
                  <div>
                    <div className="cwd-selector__browser-label">
                      {t('cwdSelector.remoteBrowserLabel')}
                    </div>
                    <div className="cwd-selector__browser-path">
                      {remoteListing?.path ?? t('cwdSelector.remoteBrowserEmptyPath')}
                    </div>
                  </div>
                  <div className="cwd-selector__browser-actions">
                    <Button
                      type="button"
                      className="cwd-selector__browser-action"
                      onClick={handleRemoteHome}
                      disabled={!remoteServerId || remoteListingLoading}
                    >
                      {t('cwdSelector.remoteHome')}
                    </Button>
                    <Button
                      type="button"
                      className="cwd-selector__browser-action"
                      onClick={handleRemoteUp}
                      disabled={!remoteParentPath || remoteListingLoading}
                    >
                      {t('cwdSelector.remoteUp')}
                    </Button>
                    <Button
                      type="button"
                      className="cwd-selector__browser-action"
                      onClick={handleRemoteRefresh}
                      disabled={!remoteServerId || remoteListingLoading}
                    >
                      {t('cwdSelector.remoteRefresh')}
                    </Button>
                  </div>
                </div>
                <div className="cwd-selector__browser-list">
                  {remoteListingLoading && (
                    <div className="cwd-selector__browser-status">
                      {t('cwdSelector.remoteLoading')}
                    </div>
                  )}
                  {!remoteListingLoading && !remoteServerId && (
                    <div className="cwd-selector__browser-status">
                      {t('cwdSelector.remoteSelectServer')}
                    </div>
                  )}
                  {!remoteListingLoading && remoteListingError && (
                    <div className="cwd-selector__browser-status cwd-selector__browser-status--error">
                      {remoteListingError}
                    </div>
                  )}
                  {!remoteListingLoading &&
                    remoteServerId &&
                    !remoteListingError &&
                    remoteListing &&
                    remoteListing.entries.length === 0 && (
                      <div className="cwd-selector__browser-status">
                        {t('cwdSelector.remoteEmpty')}
                      </div>
                    )}
                  {!remoteListingLoading &&
                    !remoteListingError &&
                    remoteListing &&
                    remoteListing.entries.map((entry) => (
                      <Button
                        key={entry.path}
                        type="button"
                        className="cwd-selector__entry"
                        onClick={() => handleRemoteEntryClick(entry.path)}
                      >
                        <FolderIcon size={14} className="cwd-selector__entry-icon" />
                        <span className="cwd-selector__entry-name">{entry.name}</span>
                      </Button>
                    ))}
                </div>
              </div>

              {remoteServerId && remotePathInput.trim().startsWith('/') && (
                <div className="cwd-selector__preview">
                  <span className="cwd-selector__preview-label">{t('cwdSelector.preview')}</span>
                  <span className="cwd-selector__preview-value">
                    {buildRemotePath(remoteServerId, remotePathInput.trim())}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="cwd-selector__footer">
          <Button type="button" className="cwd-selector__button" onClick={onClose}>
            {t('cwdSelector.cancel')}
          </Button>
          <Button
            type="button"
            className="cwd-selector__button cwd-selector__button--primary"
            onClick={handleApply}
          >
            {mode === 'local' ? t('cwdSelector.applyLocal') : t('cwdSelector.applyRemote')}
          </Button>
        </footer>
      </div>
    </div>
  );
}

export type { WorkingDirectorySelectorProps };
