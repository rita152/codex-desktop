export type GitStatusEntry = {
  path: string;
  oldPath?: string | null;
  status: string;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  conflicted: boolean;
  untracked: boolean;
  renamed: boolean;
};

export type GitStatusResult = {
  isGitRepo: boolean;
  currentBranch?: string | null;
  ahead: number;
  behind: number;
  changes: GitStatusEntry[];
  stagedChanges: GitStatusEntry[];
  root?: string | null;
};

export type GitCommit = {
  id: string;
  parents: string[];
  author: string;
  date: string;
  summary: string;
  refs: string[];
};

export type GitBranch = {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
};

export type GitRemote = {
  name: string;
  fetchUrl?: string | null;
  pushUrl?: string | null;
};

export type GitFileViewRequest = {
  path: string;
  oldPath?: string | null;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
};

export type GitFileView = {
  original: string;
  modified: string;
};
