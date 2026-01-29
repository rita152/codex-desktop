import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';

import { Button } from '../../ui/data-entry/Button';
import { FolderIcon, ServerIcon, ChevronDownIcon } from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';
import { buildRemotePath } from '../../../utils/remotePath';
import { useRemoteServers } from '../../../hooks/useRemoteServers';
import type {
  RemoteDirectoryEntry,
  RemoteDirectoryListing,
  RemoteServerConfig,
} from '../../../types/remote';

import './DirectorySelector.css';

type ViewState = 'menu' | 'servers' | 'directories';

interface DirectorySelectorProps {
  currentCwd: string;
  cwdLocked: boolean;
  onPickLocalCwd: () => void;
  onCwdSelect: (path: string) => void;
  className?: string;
}

function ChevronLeftIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function DirectorySelector({
  currentCwd,
  cwdLocked,
  onPickLocalCwd,
  onCwdSelect,
  className,
}: DirectorySelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<ViewState>('menu');
  const [selectedServer, setSelectedServer] = useState<RemoteServerConfig | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [directoryEntries, setDirectoryEntries] = useState<RemoteDirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { servers, loadServers, loading: serversLoading } = useRemoteServers();

  const handleToggle = () => {
    if (cwdLocked) return;
    if (!isOpen) {
      setIsOpen(true);
      setView('menu');
      setError(null);
    } else {
      setIsOpen(false);
    }
  };

  const handleBack = () => {
    if (view === 'directories') {
      // If we want 'back' to go up a directory?
      // Or back to server list?
      // The requirement says "click specific directory... refresh... next level".
      // It doesn't explicitly mention 'back' navigation in directory struture,
      // but it's good UX.
      // However, usually back button in header goes to previous View.
      // If we are deep in directories, maybe "Back" should go up?
      // Let's implement Back as "Go to Server List" for now to keep it simple and consistent with 'View' state.
      // Or if currentPath is not root, go up?
      // Let's stick to View navigation: Directories -> Servers -> Menu.
      setView('servers');
      setSelectedServer(null);
      setCurrentPath('');
      setDirectoryEntries([]);
    } else if (view === 'servers') {
      setView('menu');
    }
  };

  const handlePickLocal = () => {
    setIsOpen(false);
    onPickLocalCwd();
  };

  const handleSelectRemoteServerView = () => {
    setView('servers');
    loadServers();
  };

  const handleSelectServer = (server: RemoteServerConfig) => {
    setSelectedServer(server);
    setView('directories');
    setCurrentPath(''); // Start at home
    fetchDirectory(server.id, '');
  };

  const fetchDirectory = async (serverId: string, path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<RemoteDirectoryListing>('remote_list_directory', {
        serverId,
        path,
      });
      setCurrentPath(result.path);
      setDirectoryEntries(result.entries);
    } catch (err: unknown) {
      if (typeof err === 'string') {
        setError(err);
      } else if (err instanceof Error) {
        setError(err.message || 'Failed to list directory');
      } else {
        setError('Failed to list directory');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDirectory = (entry: RemoteDirectoryEntry) => {
    if (!selectedServer) return;
    fetchDirectory(selectedServer.id, entry.path);
  };

  const handleConfirmCurrentDirectory = () => {
    if (!selectedServer) return;
    const fullRemotePath = buildRemotePath(selectedServer.id, currentPath);
    onCwdSelect(fullRemotePath);
    setIsOpen(false);
  };

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    // We use a backdrop div instead of event listener for simplicity and stricter modal behavior
  }, [isOpen]);

  const renderContent = () => {
    if (view === 'menu') {
      return (
        <div className="directory-selector__list">
          <div className="directory-selector__item" onClick={handlePickLocal}>
            <FolderIcon size={14} />
            <span>{t('chat.localDirectory', 'Local Directory')}</span>
          </div>
          <div className="directory-selector__item" onClick={handleSelectRemoteServerView}>
            <ServerIcon size={14} />
            <span>{t('chat.remoteServer', 'Remote Server')}</span>
          </div>
        </div>
      );
    }

    if (view === 'servers') {
      return (
        <div className="directory-selector__list">
          <div className="directory-selector__header">
            <div className="directory-selector__back" onClick={handleBack}>
              <ChevronLeftIcon />
            </div>
            <span className="directory-selector__title">
              {t('chat.selectServer', 'Select Server')}
            </span>
          </div>
          {serversLoading ? (
            <div className="directory-selector__loading">{t('common.loading', 'Loading...')}</div>
          ) : servers.length === 0 ? (
            <div className="directory-selector__empty">
              {t('chat.noServers', 'No servers found in ~/.ssh/config')}
            </div>
          ) : (
            servers.map((server) => (
              <div
                key={server.id}
                className="directory-selector__item"
                onClick={() => handleSelectServer(server)}
              >
                <ServerIcon size={14} />
                <span>{server.name}</span>
              </div>
            ))
          )}
        </div>
      );
    }

    if (view === 'directories') {
      return (
        <>
          <div className="directory-selector__header">
            <div className="directory-selector__back" onClick={handleBack}>
              <ChevronLeftIcon />
            </div>
            <span className="directory-selector__title" title={currentPath || 'Home'}>
              {selectedServer?.name}
            </span>
          </div>
          {currentPath && (
            <div className="directory-selector__breadcrumbs" title={currentPath}>
              {currentPath}
            </div>
          )}

          <div className="directory-selector__list">
            {isLoading ? (
              <div className="directory-selector__loading">{t('common.loading', 'Loading...')}</div>
            ) : error ? (
              <div className="directory-selector__empty" style={{ color: 'var(--color-error)' }}>
                {error}
              </div>
            ) : directoryEntries.length === 0 ? (
              <div className="directory-selector__empty">
                {t('chat.emptyDirectory', 'Empty directory')}
              </div>
            ) : (
              directoryEntries.map((entry) => (
                <div
                  key={entry.name}
                  className="directory-selector__item"
                  onClick={() => handleSelectDirectory(entry)}
                >
                  <FolderIcon size={14} />
                  <span>{entry.name}</span>
                </div>
              ))
            )}
          </div>
          <div className="directory-selector__footer">
            <Button
              onClick={handleConfirmCurrentDirectory}
              disabled={isLoading}
              className="w-full justify-center"
            >
              {t('chat.selectThisDirectory', 'Select This Directory')}
            </Button>
          </div>
        </>
      );
    }
  };

  return (
    <div className={cn('directory-selector', className)}>
      <Button
        type="button"
        className="chat-container__cwd-button"
        onClick={handleToggle}
        disabled={cwdLocked}
        title={cwdLocked ? t('chat.cwdLocked') : currentCwd}
      >
        <FolderIcon size={12} />
        <span className="chat-container__meta-value">{currentCwd}</span>
        {!cwdLocked && (
          <ChevronDownIcon
            size={12}
            className={cn('transition-transform', isOpen && 'rotate-180')}
          />
        )}
      </Button>

      {isOpen && (
        <>
          <div className="directory-selector__backdrop" onClick={() => setIsOpen(false)} />
          <div className="directory-selector__dropdown">{renderContent()}</div>
        </>
      )}
    </div>
  );
}
