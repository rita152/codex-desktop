import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../ui/data-entry/Button';
import { CodeIcon, ForwardIcon } from '../../ui/data-display/Icon';
import { useGitRepository } from '../../../hooks/useGitRepository';
import type { GitCommit } from '../../../types/git';
import { isRemotePath } from '../../../utils/remotePath';

import './GitPanel.css';

type GitPanelProps = {
  visible?: boolean;
  cwd: string;
  onClose?: () => void;
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

type CommitMenuState = {
  x: number;
  y: number;
  commit: GitCommit;
} | null;

function formatCommitDate(value: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export function GitPanel({ visible = false, cwd, onClose, onResizeStart }: GitPanelProps) {
  const { t } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const [commitMenu, setCommitMenu] = useState<CommitMenuState>(null);

  const {
    status,
    history,
    branches,
    remotes,
    loading,
    actionPending,
    error,
    syncStatus,
    refreshStatus,
    refreshHistory,
    checkout,
    pull,
    push,
    fetch: fetchRemote,
    reset,
  } = useGitRepository({ cwd, enabled: visible });

  const isRemote = useMemo(() => isRemotePath(cwd), [cwd]);
  const isGitRepo = status?.isGitRepo ?? false;
  const currentBranch = status?.currentBranch ?? '';

  const primaryRemote = remotes[0]?.name;

  useEffect(() => {
    if (!visible) {
      setCommitMenu(null);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && isGitRepo) {
      void refreshHistory(undefined, true);
    }
  }, [visible, isGitRepo, refreshHistory]);

  useEffect(() => {
    if (!visible) return;
    const handleClick = () => setCommitMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [visible]);

  const handleSync = useCallback(async () => {
    if (!primaryRemote || !currentBranch) {
      return;
    }
    setSyncing(true);
    try {
      if (syncStatus.isBehind) {
        await pull(primaryRemote, currentBranch);
      }
      if (syncStatus.isAhead) {
        await push(primaryRemote, currentBranch, false);
      }
      if (!syncStatus.isAhead && !syncStatus.isBehind) {
        await fetchRemote(primaryRemote);
      }
    } finally {
      setSyncing(false);
    }
  }, [
    currentBranch,
    fetchRemote,
    primaryRemote,
    pull,
    push,
    syncStatus.isAhead,
    syncStatus.isBehind,
  ]);

  const handleSwitchBranch = useCallback(async () => {
    const name = window.prompt(t('gitPanel.checkoutPrompt'), currentBranch || undefined);
    if (!name?.trim()) return;
    await checkout(name.trim());
  }, [checkout, currentBranch, t]);

  const handleCreateBranch = useCallback(async () => {
    const name = window.prompt(t('gitPanel.createBranchPrompt'));
    if (!name?.trim()) return;
    await checkout(name.trim(), true);
  }, [checkout, t]);

  const handleCommitContextMenu = useCallback(
    (event: React.MouseEvent, commitItem: GitCommit) => {
      event.preventDefault();
      setCommitMenu({ x: event.clientX, y: event.clientY, commit: commitItem });
    },
    []
  );

  const handleCheckoutCommit = useCallback(async () => {
    if (!commitMenu) return;
    await checkout(commitMenu.commit.id);
    setCommitMenu(null);
  }, [checkout, commitMenu]);

  const handleResetCommit = useCallback(async () => {
    if (!commitMenu) return;
    const confirmed = window.confirm(t('gitPanel.confirmReset'));
    if (!confirmed) return;
    await reset(commitMenu.commit.id, 'hard');
    setCommitMenu(null);
  }, [commitMenu, reset, t]);

  if (!visible) {
    return (
      <aside className="git-panel git-panel--hidden" aria-hidden>
        <div className="git-panel__body" />
      </aside>
    );
  }

  return (
    <aside className="git-panel" aria-hidden={!visible}>
      {visible && (
        <div
          className="git-panel__resize-handle"
          role="separator"
          aria-label={t('gitPanel.resize')}
          aria-orientation="vertical"
          onPointerDown={onResizeStart}
          tabIndex={0}
        />
      )}
      <header className="git-panel__header">
        <div className="git-panel__title">
          <CodeIcon size={16} />
          <span>{t('gitPanel.title')}</span>
        </div>
        <div className="git-panel__header-actions">
          <Button
            type="button"
            className="git-panel__header-btn"
            onClick={() => void refreshStatus()}
            disabled={loading || actionPending}
          >
            {t('gitPanel.refresh')}
          </Button>
          <Button
            type="button"
            className="git-panel__header-btn"
            onClick={handleSync}
            disabled={syncing || actionPending || !primaryRemote || !currentBranch}
          >
            <ForwardIcon size={14} />
            {syncing ? t('gitPanel.syncing') : t('gitPanel.sync')}
          </Button>
          <Button
            type="button"
            className="git-panel__header-btn"
            onClick={onClose}
            aria-label={t('gitPanel.close')}
          >
            {t('gitPanel.close')}
          </Button>
        </div>
      </header>

      <div className="git-panel__body">
        {isRemote && (
          <div className="git-panel__empty">{t('gitPanel.remoteNotSupported')}</div>
        )}
        {!isRemote && error && <div className="git-panel__error">{error}</div>}
        {!isRemote && !isGitRepo && (
          <div className="git-panel__empty">{t('gitPanel.noRepo')}</div>
        )}
        {!isRemote && isGitRepo && (
          <>
            <div className="git-panel__meta">
              <div className="git-panel__branch">
                <span className="git-panel__meta-label">{t('gitPanel.branch')}</span>
                <span className="git-panel__meta-value">{currentBranch || 'HEAD'}</span>
              </div>
              <div className="git-panel__sync-status">
                <span className="git-panel__meta-label">{t('gitPanel.ahead')}</span>
                <span className="git-panel__meta-value">{syncStatus.ahead}</span>
                <span className="git-panel__meta-label">{t('gitPanel.behind')}</span>
                <span className="git-panel__meta-value">{syncStatus.behind}</span>
              </div>
              <div className="git-panel__meta-actions">
                <Button
                  type="button"
                  className="git-panel__meta-btn"
                  onClick={handleSwitchBranch}
                  disabled={actionPending || branches.length === 0}
                >
                  {t('gitPanel.switchBranch')}
                </Button>
                <Button
                  type="button"
                  className="git-panel__meta-btn"
                  onClick={handleCreateBranch}
                  disabled={actionPending}
                >
                  {t('gitPanel.createBranch')}
                </Button>
              </div>
            </div>

            <div className="git-panel__history-view">
              {loading && <div className="git-panel__loading">{t('gitPanel.loading')}</div>}
              {!loading && history.length === 0 && (
                <div className="git-panel__empty">{t('gitPanel.noHistory')}</div>
              )}
              {!loading && history.length > 0 && (
                <div className="git-panel__history-list">
                  {history.map((commitItem) => (
                    <div
                      key={commitItem.id}
                      className="git-panel__commit-row"
                      onContextMenu={(event) => handleCommitContextMenu(event, commitItem)}
                    >
                      <div className="git-panel__graph">
                        <span className="git-panel__graph-line" />
                        <span className="git-panel__graph-dot" />
                      </div>
                      <div className="git-panel__commit-info">
                        <div className="git-panel__commit-summary">{commitItem.summary}</div>
                        <div className="git-panel__commit-meta">
                          <span>{commitItem.id.slice(0, 7)}</span>
                          <span>{commitItem.author}</span>
                          <span>{formatCommitDate(commitItem.date)}</span>
                        </div>
                        {commitItem.refs.length > 0 && (
                          <div className="git-panel__commit-refs">
                            {commitItem.refs.map((ref) => (
                              <span key={ref} className="git-panel__ref">
                                {ref}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {commitMenu && (
        <div
          className="git-panel__context-menu"
          style={{ left: commitMenu.x, top: commitMenu.y }}
        >
          <button
            type="button"
            className="git-panel__context-item"
            onClick={handleCheckoutCommit}
          >
            {t('gitPanel.contextCheckout')}
          </button>
          <button
            type="button"
            className="git-panel__context-item"
            onClick={handleResetCommit}
          >
            {t('gitPanel.contextReset')}
          </button>
        </div>
      )}
    </aside>
  );
}

export type { GitPanelProps };
