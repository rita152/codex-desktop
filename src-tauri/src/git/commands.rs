//! Tauri commands for Git integration.

use crate::git::types::{GitCommit, GitStatusEntry, GitStatusResult};
use crate::git::{run_git, run_git_owned};
use std::path::{Path, PathBuf};

fn normalize_cwd(cwd: &str) -> Result<PathBuf, String> {
    let trimmed = cwd.trim();
    if trimmed.is_empty() {
        return Err("Working directory is empty".to_string());
    }
    Ok(PathBuf::from(trimmed))
}

fn is_git_repo(cwd: &Path) -> bool {
    run_git(cwd, &["rev-parse", "--is-inside-work-tree"])
        .map(|value| value.trim() == "true")
        .unwrap_or(false)
}

fn repo_root(cwd: &Path) -> Option<PathBuf> {
    run_git(cwd, &["rev-parse", "--show-toplevel"])
        .ok()
        .map(|value| PathBuf::from(value.trim()))
}

fn parse_branch_line(line: &str) -> (Option<String>, usize, usize) {
    let mut ahead = 0;
    let mut behind = 0;
    let mut branch_part = line.trim_start_matches("## ").trim();

    if let Some(bracket_idx) = branch_part.find(" [") {
        let (head, tail) = branch_part.split_at(bracket_idx);
        branch_part = head.trim();
        let meta = tail.trim_start_matches(" [").trim_end_matches(']');
        for token in meta.split(',') {
            let token = token.trim();
            if let Some(value) = token.strip_prefix("ahead ") {
                ahead = value.trim().parse::<usize>().unwrap_or(0);
            } else if let Some(value) = token.strip_prefix("behind ") {
                behind = value.trim().parse::<usize>().unwrap_or(0);
            }
        }
    }

    let branch_name = if let Some(dots) = branch_part.find("...") {
        branch_part[..dots].trim()
    } else {
        branch_part.trim()
    };

    let branch_name = if let Some(name) = branch_name.strip_prefix("No commits yet on ") {
        name.trim()
    } else {
        branch_name
    };

    let branch = if branch_name.is_empty() {
        None
    } else {
        Some(branch_name.to_string())
    };

    (branch, ahead, behind)
}

fn is_conflicted_status(status: &str) -> bool {
    matches!(status, "DD" | "AU" | "UD" | "UA" | "DU" | "AA" | "UU")
}

fn parse_status_output(
    output: &str,
) -> (
    Option<String>,
    usize,
    usize,
    Vec<GitStatusEntry>,
    Vec<GitStatusEntry>,
) {
    let mut branch_line: Option<String> = None;
    let mut changes = Vec::new();
    let mut staged_changes = Vec::new();

    let mut iter = output.split('\0').peekable();
    while let Some(token) = iter.next() {
        if token.is_empty() {
            continue;
        }
        if token.starts_with("## ") {
            branch_line = Some(token.to_string());
            continue;
        }
        if token.len() < 4 {
            continue;
        }

        let status = &token[..2];
        let mut path = token[3..].to_string();
        let mut old_path = None;

        if status.contains('R') || status.contains('C') {
            if let Some(next_path) = iter.next() {
                old_path = Some(path);
                path = next_path.to_string();
            }
        }

        let index_status = status.chars().next().unwrap_or(' ');
        let worktree_status = status.chars().nth(1).unwrap_or(' ');
        let untracked = status == "??";
        let staged = index_status != ' ' && index_status != '?';
        let unstaged = worktree_status != ' ' && worktree_status != '?';
        let conflicted = is_conflicted_status(status);
        let renamed = index_status == 'R' || worktree_status == 'R';

        let entry = GitStatusEntry {
            path,
            old_path,
            status: status.to_string(),
            index_status: index_status.to_string(),
            worktree_status: worktree_status.to_string(),
            staged,
            unstaged: unstaged || untracked,
            conflicted,
            untracked,
            renamed,
        };

        match (staged, unstaged || untracked) {
            (true, true) => {
                staged_changes.push(entry.clone());
                changes.push(entry);
            }
            (true, false) => staged_changes.push(entry),
            (false, true) => changes.push(entry),
            (false, false) => {}
        }
    }

    let (branch, ahead, behind) = branch_line
        .as_deref()
        .map(parse_branch_line)
        .unwrap_or((None, 0, 0));

    (branch, ahead, behind, changes, staged_changes)
}

#[tauri::command]
pub fn git_status(cwd: String) -> Result<GitStatusResult, String> {
    let cwd = normalize_cwd(&cwd)?;
    if !is_git_repo(&cwd) {
        return Ok(GitStatusResult {
            is_git_repo: false,
            current_branch: None,
            ahead: 0,
            behind: 0,
            changes: Vec::new(),
            staged_changes: Vec::new(),
            root: None,
        });
    }

    let root = repo_root(&cwd).map(|path| path.display().to_string());
    let output = run_git(&cwd, &["status", "--porcelain", "-b", "-z"])?;
    let (branch, ahead, behind, changes, staged_changes) = parse_status_output(&output);

    Ok(GitStatusResult {
        is_git_repo: true,
        current_branch: branch,
        ahead,
        behind,
        changes,
        staged_changes,
        root,
    })
}

#[tauri::command]
pub fn git_history(
    cwd: String,
    limit: Option<usize>,
    all: Option<bool>,
) -> Result<Vec<GitCommit>, String> {
    let cwd = normalize_cwd(&cwd)?;
    let mut args = vec![
        "log".to_string(),
        "--pretty=format:%H%x1f%P%x1f%an%x1f%ad%x1f%D%x1f%s%x1e".to_string(),
        "--date=iso-strict".to_string(),
        "--date-order".to_string(),
    ];
    if all.unwrap_or(false) {
        args.push("--all".to_string());
    }
    if let Some(limit) = limit {
        args.push(format!("--max-count={}", limit));
    }
    let output = match run_git_owned(&cwd, &args) {
        Ok(value) => value,
        Err(err) => {
            if err.contains("does not have any commits yet") || err.contains("No commits yet") {
                return Ok(Vec::new());
            }
            return Err(err);
        }
    };

    let mut commits = Vec::new();
    for record in output.split('\x1e') {
        if record.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = record.split('\x1f').collect();
        if fields.len() < 6 {
            continue;
        }
        let parents = if fields[1].trim().is_empty() {
            Vec::new()
        } else {
            fields[1]
                .split_whitespace()
                .map(|s| s.to_string())
                .collect()
        };
        let refs = if fields[4].trim().is_empty() {
            Vec::new()
        } else {
            fields[4]
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        };

        commits.push(GitCommit {
            id: fields[0].to_string(),
            parents,
            author: fields[2].to_string(),
            date: fields[3].to_string(),
            refs,
            summary: fields[5].to_string(),
        });
    }

    Ok(commits)
}

#[tauri::command]
pub fn git_checkout(
    cwd: String,
    branch: String,
    create: Option<bool>,
    start_point: Option<String>,
) -> Result<(), String> {
    let cwd = normalize_cwd(&cwd)?;
    let mut args = vec!["checkout".to_string()];
    if create.unwrap_or(false) {
        args.push("-b".to_string());
    }
    args.push(branch);
    if let Some(start) = start_point {
        if !start.trim().is_empty() {
            args.push(start);
        }
    }
    run_git_owned(&cwd, &args).map(|_| ())
}

#[tauri::command]
pub fn git_reset(cwd: String, commit: String, mode: Option<String>) -> Result<(), String> {
    let cwd = normalize_cwd(&cwd)?;
    let mode_flag = match mode.as_deref() {
        Some("soft") => "--soft",
        Some("mixed") => "--mixed",
        _ => "--hard",
    };
    let args = vec!["reset".to_string(), mode_flag.to_string(), commit];
    run_git_owned(&cwd, &args).map(|_| ())
}
