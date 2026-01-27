import { invoke } from '@tauri-apps/api/core';

import type { GitStatusResult, GitCommit, RemoteGitHistoryResult } from '../types/git';

export async function gitStatus(cwd: string): Promise<GitStatusResult> {
  return invoke<GitStatusResult>('git_status', { cwd });
}

export async function gitHistory(cwd: string, limit?: number, all?: boolean): Promise<GitCommit[]> {
  return invoke<GitCommit[]>('git_history', { cwd, limit, all });
}

export async function remoteGitHistory(
  serverId: string,
  path: string,
  limit?: number,
  all?: boolean
): Promise<RemoteGitHistoryResult> {
  return invoke<RemoteGitHistoryResult>('remote_git_history', {
    serverId,
    path,
    limit,
    all,
  });
}

export async function gitCheckout(
  cwd: string,
  branch: string,
  create?: boolean,
  startPoint?: string
): Promise<void> {
  await invoke('git_checkout', { cwd, branch, create, start_point: startPoint });
}

export async function gitReset(
  cwd: string,
  commit: string,
  mode?: 'hard' | 'soft' | 'mixed'
): Promise<void> {
  await invoke('git_reset', { cwd, commit, mode });
}
