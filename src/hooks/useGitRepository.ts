import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  gitBranchList,
  gitCommit,
  gitDiscard,
  gitFetch,
  gitHistory,
  gitPull,
  gitPush,
  gitRemotes,
  gitStage,
  gitStatus,
  gitUnstage,
  gitCheckout,
  gitReset,
} from '../api/git';
import type { GitBranch, GitCommit, GitRemote, GitStatusResult } from '../types/git';
import { isRemotePath } from '../utils/remotePath';

export type GitSyncStatus = {
  ahead: number;
  behind: number;
  isAhead: boolean;
  isBehind: boolean;
};

export type UseGitRepositoryResult = {
  status: GitStatusResult | null;
  history: GitCommit[];
  branches: GitBranch[];
  remotes: GitRemote[];
  loading: boolean;
  actionPending: boolean;
  error: string | null;
  syncStatus: GitSyncStatus;
  refreshStatus: () => Promise<void>;
  refreshHistory: (limit?: number, all?: boolean) => Promise<void>;
  refreshBranches: () => Promise<void>;
  refreshRemotes: () => Promise<void>;
  stage: (paths: string[], stageAll?: boolean) => Promise<void>;
  unstage: (paths: string[]) => Promise<void>;
  discard: (paths: string[], includeUntracked?: boolean) => Promise<void>;
  commit: (message: string) => Promise<void>;
  checkout: (branch: string, create?: boolean, startPoint?: string) => Promise<void>;
  pull: (remote?: string, branch?: string) => Promise<void>;
  push: (remote?: string, branch?: string, setUpstream?: boolean) => Promise<void>;
  fetch: (remote?: string) => Promise<void>;
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
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef(false);

  const isEnabled = Boolean(enabled && cwd && cwd.trim() !== '' && !isRemotePath(cwd));

  const refreshStatus = useCallback(async () => {
    if (!isEnabled || !cwd) {
      setStatus(null);
      return;
    }
    if (inflightRef.current) return;
    inflightRef.current = true;
    setLoading(true);
    try {
      const result = await gitStatus(cwd);
      setStatus(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      inflightRef.current = false;
      setLoading(false);
    }
  }, [cwd, isEnabled]);

  const refreshHistory = useCallback(
    async (limit?: number, all?: boolean) => {
      if (!isEnabled || !cwd) {
        setHistory([]);
        return;
      }
      setLoading(true);
      try {
        const result = await gitHistory(cwd, limit, all);
        setHistory(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [cwd, isEnabled]
  );

  const refreshBranches = useCallback(async () => {
    if (!isEnabled || !cwd) {
      setBranches([]);
      return;
    }
    try {
      const result = await gitBranchList(cwd);
      setBranches(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [cwd, isEnabled]);

  const refreshRemotes = useCallback(async () => {
    if (!isEnabled || !cwd) {
      setRemotes([]);
      return;
    }
    try {
      const result = await gitRemotes(cwd);
      setRemotes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [cwd, isEnabled]);

  const stage = useCallback(
    async (paths: string[], stageAll?: boolean) => {
      if (!isEnabled || !cwd) return;
      setActionPending(true);
      try {
        await gitStage(cwd, paths, stageAll);
        await refreshStatus();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActionPending(false);
      }
    },
    [cwd, isEnabled, refreshStatus]
  );

  const unstage = useCallback(
    async (paths: string[]) => {
      if (!isEnabled || !cwd) return;
      setActionPending(true);
      try {
        await gitUnstage(cwd, paths);
        await refreshStatus();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActionPending(false);
      }
    },
    [cwd, isEnabled, refreshStatus]
  );

  const discard = useCallback(
    async (paths: string[], includeUntracked?: boolean) => {
      if (!isEnabled || !cwd) return;
      setActionPending(true);
      try {
        await gitDiscard(cwd, paths, includeUntracked);
        await refreshStatus();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActionPending(false);
      }
    },
    [cwd, isEnabled, refreshStatus]
  );

  const commit = useCallback(
    async (message: string) => {
      if (!isEnabled || !cwd) return;
      setActionPending(true);
      try {
        await gitCommit(cwd, message);
        await refreshStatus();
        await refreshHistory(undefined, true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActionPending(false);
      }
    },
    [cwd, isEnabled, refreshStatus, refreshHistory]
  );

  const checkout = useCallback(
    async (branch: string, create?: boolean, startPoint?: string) => {
      if (!isEnabled || !cwd) return;
      setActionPending(true);
      try {
        await gitCheckout(cwd, branch, create, startPoint);
        await refreshStatus();
        await refreshBranches();
        await refreshHistory(undefined, true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActionPending(false);
      }
    },
    [cwd, isEnabled, refreshBranches, refreshHistory, refreshStatus]
  );

  const pull = useCallback(
    async (remote?: string, branch?: string) => {
      if (!isEnabled || !cwd) return;
      setActionPending(true);
      try {
        await gitPull(cwd, remote, branch);
        await refreshStatus();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActionPending(false);
      }
    },
    [cwd, isEnabled, refreshStatus]
  );

  const push = useCallback(
    async (remote?: string, branch?: string, setUpstream?: boolean) => {
      if (!isEnabled || !cwd) return;
      setActionPending(true);
      try {
        await gitPush(cwd, remote, branch, setUpstream);
        await refreshStatus();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActionPending(false);
      }
    },
    [cwd, isEnabled, refreshStatus]
  );

  const fetch = useCallback(
    async (remote?: string) => {
      if (!isEnabled || !cwd) return;
      setActionPending(true);
      try {
        await gitFetch(cwd, remote);
        await refreshStatus();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActionPending(false);
      }
    },
    [cwd, isEnabled, refreshStatus]
  );

  const reset = useCallback(
    async (commitSha: string, mode?: 'hard' | 'soft' | 'mixed') => {
      if (!isEnabled || !cwd) return;
      setActionPending(true);
      try {
        await gitReset(cwd, commitSha, mode);
        await refreshStatus();
        await refreshHistory(undefined, true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActionPending(false);
      }
    },
    [cwd, isEnabled, refreshHistory, refreshStatus]
  );

  useEffect(() => {
    if (!isEnabled) {
      setStatus(null);
      setHistory([]);
      setBranches([]);
      setRemotes([]);
      return;
    }
    void refreshStatus();
  }, [isEnabled, refreshStatus]);

  useEffect(() => {
    if (!isEnabled || !status?.isGitRepo) {
      setBranches([]);
      setRemotes([]);
      return;
    }
    void refreshBranches();
    void refreshRemotes();
  }, [isEnabled, refreshBranches, refreshRemotes, status?.isGitRepo]);

  useEffect(() => {
    if (!isEnabled) return;
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [isEnabled, refreshStatus]);

  const syncStatus = useMemo<GitSyncStatus>(() => {
    const ahead = status?.ahead ?? 0;
    const behind = status?.behind ?? 0;
    return {
      ahead,
      behind,
      isAhead: ahead > 0,
      isBehind: behind > 0,
    };
  }, [status?.ahead, status?.behind]);

  return {
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
    refreshBranches,
    refreshRemotes,
    stage,
    unstage,
    discard,
    commit,
    checkout,
    pull,
    push,
    fetch,
    reset,
  };
}
