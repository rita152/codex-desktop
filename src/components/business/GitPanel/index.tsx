import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';


import { useGitRepository } from '../../../hooks/useGitRepository';
import type { GitCommit } from '../../../types/git';
import { isRemotePath } from '../../../utils/remotePath';

import './GitPanel.css';

type GitPanelProps = {
  visible?: boolean;
  cwd: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const [commitMenu, setCommitMenu] = useState<CommitMenuState>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const {
    status,
    history,
    error,
    refreshHistory,
    checkout,
    reset,
  } = useGitRepository({ cwd, enabled: visible });

  const isRemote = useMemo(() => isRemotePath(cwd), [cwd]);
  const isGitRepo = status?.isGitRepo ?? false;

  useEffect(() => {
    if (!visible) {
      setCommitMenu(null);
    }
  }, [visible]);

  const refreshHistoryWithLoading = useCallback(
    async (limit?: number, all?: boolean) => {
      setHistoryLoading(true);
      try {
        await refreshHistory(limit, all);
      } finally {
        setHistoryLoading(false);
      }
    },
    [refreshHistory]
  );

  useEffect(() => {
    if (visible && isGitRepo) {
      void refreshHistoryWithLoading(undefined, true);
    }
  }, [visible, isGitRepo, refreshHistoryWithLoading]);

  useEffect(() => {
    if (!visible) return;
    const handleClick = () => setCommitMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [visible]);

  const handleCommitContextMenu = useCallback(
    (event: React.MouseEvent, commitItem: GitCommit) => {
      event.preventDefault();
      setCommitMenu({ x: event.clientX, y: event.clientY, commit: commitItem });
    },
    []
  );

  const handleCheckoutCommit = useCallback(async () => {
    if (!commitMenu) return;
    setHistoryLoading(true);
    try {
      await checkout(commitMenu.commit.id);
    } finally {
      setHistoryLoading(false);
    }
    setCommitMenu(null);
  }, [checkout, commitMenu]);

  const handleResetCommit = useCallback(async () => {
    if (!commitMenu) return;
    const confirmed = window.confirm(t('gitPanel.confirmReset'));
    if (!confirmed) return;
    setHistoryLoading(true);
    try {
      await reset(commitMenu.commit.id, 'hard');
    } finally {
      setHistoryLoading(false);
    }
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
      <div
        className="git-panel__resize-handle"
        role="separator"
        aria-label={t('gitPanel.resize')}
        aria-orientation="vertical"
        onPointerDown={onResizeStart}
        tabIndex={0}
      />

      <div className="git-panel__body">
        {isRemote && (
          <div className="git-panel__empty">{t('gitPanel.remoteNotSupported')}</div>
        )}
        {!isRemote && error && <div className="git-panel__error">{error}</div>}
        {!isRemote && !isGitRepo && (
          <div className="git-panel__empty">{t('gitPanel.noRepo')}</div>
        )}
        {!isRemote && isGitRepo && (
          <div className="git-panel__history-view">
            {historyLoading && <div className="git-panel__loading">{t('gitPanel.loading')}</div>}
            {!historyLoading && history.length === 0 && (
              <div className="git-panel__empty">{t('gitPanel.noHistory')}</div>
            )}
            {history.length > 0 && (
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
