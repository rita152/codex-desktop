import { invoke } from '@tauri-apps/api/core';

import type {
  GitStatusResult,
  GitCommit,
  GitBranch,
  GitRemote,
  GitFileView,
  GitFileViewRequest,
} from '../types/git';

export async function gitStatus(cwd: string): Promise<GitStatusResult> {
  return invoke<GitStatusResult>('git_status', { cwd });
}

export async function gitDiff(cwd: string, path?: string, staged?: boolean): Promise<string> {
  return invoke<string>('git_diff', { cwd, path, staged });
}

export async function gitStage(cwd: string, paths: string[], stageAll?: boolean): Promise<void> {
  await invoke('git_stage', { cwd, paths, stage_all: stageAll });
}

export async function gitUnstage(cwd: string, paths: string[]): Promise<void> {
  await invoke('git_unstage', { cwd, paths });
}

export async function gitCommit(cwd: string, message: string): Promise<string> {
  return invoke<string>('git_commit', { cwd, message });
}

export async function gitDiscard(
  cwd: string,
  paths: string[],
  includeUntracked?: boolean
): Promise<void> {
  await invoke('git_discard', { cwd, paths, include_untracked: includeUntracked });
}

export async function gitHistory(cwd: string, limit?: number, all?: boolean): Promise<GitCommit[]> {
  return invoke<GitCommit[]>('git_history', { cwd, limit, all });
}

export async function gitBranchList(cwd: string): Promise<GitBranch[]> {
  return invoke<GitBranch[]>('git_branch_list', { cwd });
}

export async function gitCheckout(
  cwd: string,
  branch: string,
  create?: boolean,
  startPoint?: string
): Promise<void> {
  await invoke('git_checkout', { cwd, branch, create, start_point: startPoint });
}

export async function gitPush(
  cwd: string,
  remote?: string,
  branch?: string,
  setUpstream?: boolean
): Promise<string> {
  return invoke<string>('git_push', { cwd, remote, branch, set_upstream: setUpstream });
}

export async function gitPull(cwd: string, remote?: string, branch?: string): Promise<string> {
  return invoke<string>('git_pull', { cwd, remote, branch });
}

export async function gitFetch(cwd: string, remote?: string): Promise<string> {
  return invoke<string>('git_fetch', { cwd, remote });
}

export async function gitRemotes(cwd: string): Promise<GitRemote[]> {
  return invoke<GitRemote[]>('git_remotes', { cwd });
}

export async function gitFileView(cwd: string, payload: GitFileViewRequest): Promise<GitFileView> {
  const { path, oldPath, indexStatus, worktreeStatus, staged } = payload;
  return invoke<GitFileView>('git_file_view', {
    cwd,
    path,
    old_path: oldPath,
    index_status: indexStatus,
    worktree_status: worktreeStatus,
    staged,
  });
}

export async function gitReset(
  cwd: string,
  commit: string,
  mode?: 'hard' | 'soft' | 'mixed'
): Promise<void> {
  await invoke('git_reset', { cwd, commit, mode });
}
