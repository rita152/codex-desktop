//! Serializable Git data structures returned to the frontend.

use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusEntry {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub index_status: String,
    pub worktree_status: String,
    pub staged: bool,
    pub unstaged: bool,
    pub conflicted: bool,
    pub untracked: bool,
    pub renamed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    pub is_git_repo: bool,
    pub current_branch: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub changes: Vec<GitStatusEntry>,
    pub staged_changes: Vec<GitStatusEntry>,
    pub root: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    pub id: String,
    pub parents: Vec<String>,
    pub author: String,
    pub date: String,
    pub summary: String,
    pub refs: Vec<String>,
}
