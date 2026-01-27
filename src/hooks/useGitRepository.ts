import { useCallback, useEffect, useRef, useState } from 'react';

import {
  gitHistory,
  gitStatus,
  gitCheckout,
  gitReset,
  remoteGitHistory,
} from '../api/git';
import type { GitCommit, GitStatusResult } from '../types/git';
import { isRemotePath, parseRemotePath } from '../utils/remotePath';

export type UseGitRepositoryResult = {
  status: GitStatusResult | null;
  history: GitCommit[];
  error: string | null;
  refreshHistory: (limit?: number, all?: boolean) => Promise<void>;
  checkout: (branch: string, create?: boolean, startPoint?: string) => Promise<void>;
  reset: (commit: string, mode?: 'hard' | 'soft' | 'mixed') => Promise<void>;
};

export function useGitRepository({
  cwd,
  enabled = true,
}: {
  cwd?: string | null;
  enabled?: boolean;
}): UseGitRepositoryResult {
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [history, setHistory] = useState<GitCommit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef(false);

  const isRemote = Boolean(cwd && isRemotePath(cwd));
  const isHistoryEnabled = Boolean(enabled && cwd && cwd.trim() !== '');
  const isLocalEnabled = Boolean(enabled && cwd && cwd.trim() !== '' && !isRemote);

  const refreshStatus = useCallback(async () => {
    if (!isLocalEnabled || !cwd) {
      setStatus(null);
      return;
    }
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const result = await gitStatus(cwd);
      setStatus(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      inflightRef.current = false;
    }
  }, [cwd, isLocalEnabled]);

  const refreshHistory = useCallback(
    async (limit?: number, all?: boolean) => {
      if (!isHistoryEnabled || !cwd) {
        setHistory([]);
        setStatus(null);
        return;
      }
      try {
        if (isRemote) {
          const parsed = parseRemotePath(cwd);
          if (!parsed.isRemote || parsed.error || !parsed.serverId) {
            throw new Error(parsed.error || 'Invalid remote path');
          }
          const resolvedAll = all ?? true;
          const result = await remoteGitHistory(parsed.serverId, parsed.path || '', limit, resolvedAll);
          setHistory(result.history);
          setStatus({
            isGitRepo: result.isGitRepo,
            currentBranch: null,
            ahead: 0,
            behind: 0,
            changes: [],
            stagedChanges: [],
            root: null,
          });
        } else {
          const result = await gitHistory(cwd, limit, all);
          setHistory(result);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [cwd, isHistoryEnabled, isRemote]
  );

  const checkout = useCallback(
    async (branch: string, create?: boolean, startPoint?: string) => {
      if (!isLocalEnabled || !cwd) return;
      try {
        await gitCheckout(cwd, branch, create, startPoint);
        await refreshStatus();
        await refreshHistory(undefined, true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [cwd, isLocalEnabled, refreshHistory, refreshStatus]
  );

  const reset = useCallback(
    async (commitSha: string, mode?: 'hard' | 'soft' | 'mixed') => {
      if (!isLocalEnabled || !cwd) return;
      try {
        await gitReset(cwd, commitSha, mode);
        await refreshStatus();
        await refreshHistory(undefined, true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [cwd, isLocalEnabled, refreshHistory, refreshStatus]
  );

  useEffect(() => {
    if (!isHistoryEnabled) {
      setStatus(null);
      setHistory([]);
      return;
    }
    if (!isLocalEnabled) {
      setStatus(null);
      return;
    }
    void refreshStatus();
  }, [isHistoryEnabled, isLocalEnabled, refreshStatus]);

  useEffect(() => {
    if (!isLocalEnabled) return;
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [isLocalEnabled, refreshStatus]);

  return {
    status,
    history,
    error,
    refreshHistory,
    checkout,
    reset,
  };
}
