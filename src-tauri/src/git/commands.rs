//! Tauri commands for Git integration.

use crate::git::{run_git, run_git_owned};
use crate::git::types::{GitBranch, GitCommit, GitFileView, GitRemote, GitStatusEntry, GitStatusResult};
use std::collections::HashMap;
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
    matches!(
        status,
        "DD" | "AU" | "UD" | "UA" | "DU" | "AA" | "UU"
    )
}

fn parse_status_output(
    output: &str,
) -> (Option<String>, usize, usize, Vec<GitStatusEntry>, Vec<GitStatusEntry>) {
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

fn read_worktree_file(root: &Path, path: &str) -> String {
    let file_path = root.join(path);
    match std::fs::read(&file_path) {
        Ok(bytes) => String::from_utf8_lossy(&bytes).to_string(),
        Err(_) => String::new(),
    }
}

fn git_show(cwd: &Path, spec: &str) -> String {
    let args = vec!["show".to_string(), spec.to_string()];
    run_git_owned(cwd, &args).unwrap_or_default()
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
pub fn git_diff(cwd: String, path: Option<String>, staged: Option<bool>) -> Result<String, String> {
    let cwd = normalize_cwd(&cwd)?;
    if !is_git_repo(&cwd) {
        return Err("Not a git repository".to_string());
    }
    let mut args = vec!["diff".to_string()];
    if staged.unwrap_or(false) {
        args.push("--cached".to_string());
    }
    if let Some(path) = path {
        args.push("--".to_string());
        args.push(path);
    }
    run_git_owned(&cwd, &args)
}

#[tauri::command]
pub fn git_stage(cwd: String, paths: Vec<String>, stage_all: Option<bool>) -> Result<(), String> {
    let cwd = normalize_cwd(&cwd)?;
    let mut args = vec!["add".to_string()];
    if stage_all.unwrap_or(false) || paths.is_empty() {
        args.push("-A".to_string());
    } else {
        args.push("--".to_string());
        args.extend(paths);
    }
    run_git_owned(&cwd, &args).map(|_| ())
}

#[tauri::command]
pub fn git_unstage(cwd: String, paths: Vec<String>) -> Result<(), String> {
    let cwd = normalize_cwd(&cwd)?;
    let mut args = vec!["restore".to_string(), "--staged".to_string(), "--".to_string()];
    if paths.is_empty() {
        args.push(".".to_string());
    } else {
        args.extend(paths);
    }
    run_git_owned(&cwd, &args).map(|_| ())
}

#[tauri::command]
pub fn git_commit(cwd: String, message: String) -> Result<String, String> {
    let cwd = normalize_cwd(&cwd)?;
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err("Commit message is empty".to_string());
    }
    let args = vec!["commit".to_string(), "-m".to_string(), trimmed.to_string()];
    run_git_owned(&cwd, &args)
}

#[tauri::command]
pub fn git_discard(
    cwd: String,
    paths: Vec<String>,
    include_untracked: Option<bool>,
) -> Result<(), String> {
    let cwd = normalize_cwd(&cwd)?;
    let targets = if paths.is_empty() {
        vec![".".to_string()]
    } else {
        paths
    };
    let mut restore_args = vec!["restore".to_string(), "--".to_string()];
    restore_args.extend(targets.clone());
    let include_untracked = include_untracked.unwrap_or(false);
    if let Err(err) = run_git_owned(&cwd, &restore_args) {
        if !(include_untracked && err.contains("pathspec")) {
            return Err(err);
        }
    }

    if include_untracked {
        let mut clean_args = vec!["clean".to_string(), "-fd".to_string(), "--".to_string()];
        clean_args.extend(targets);
        run_git_owned(&cwd, &clean_args)?;
    }

    Ok(())
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
            fields[1].split_whitespace().map(|s| s.to_string()).collect()
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
pub fn git_branch_list(cwd: String) -> Result<Vec<GitBranch>, String> {
    let cwd = normalize_cwd(&cwd)?;
    let output = run_git(&cwd, &["branch", "--all", "--no-color"])?;
    let mut branches = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let is_current = trimmed.starts_with('*');
        let name = trimmed.trim_start_matches('*').trim();
        if name.contains("->") {
            continue;
        }
        let (is_remote, cleaned) = if let Some(rest) = name.strip_prefix("remotes/") {
            (true, rest)
        } else {
            (false, name)
        };

        branches.push(GitBranch {
            name: cleaned.to_string(),
            is_current,
            is_remote,
        });
    }

    Ok(branches)
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
pub fn git_push(
    cwd: String,
    remote: Option<String>,
    branch: Option<String>,
    set_upstream: Option<bool>,
) -> Result<String, String> {
    let cwd = normalize_cwd(&cwd)?;
    let mut args = vec!["push".to_string()];
    if set_upstream.unwrap_or(false) {
        args.push("-u".to_string());
    }
    if let Some(remote) = remote {
        args.push(remote);
    }
    if let Some(branch) = branch {
        if !branch.trim().is_empty() {
            args.push(branch);
        }
    }
    run_git_owned(&cwd, &args)
}

#[tauri::command]
pub fn git_pull(cwd: String, remote: Option<String>, branch: Option<String>) -> Result<String, String> {
    let cwd = normalize_cwd(&cwd)?;
    let mut args = vec!["pull".to_string()];
    if let Some(remote) = remote {
        args.push(remote);
    }
    if let Some(branch) = branch {
        if !branch.trim().is_empty() {
            args.push(branch);
        }
    }
    run_git_owned(&cwd, &args)
}

#[tauri::command]
pub fn git_fetch(cwd: String, remote: Option<String>) -> Result<String, String> {
    let cwd = normalize_cwd(&cwd)?;
    let mut args = vec!["fetch".to_string()];
    if let Some(remote) = remote {
        args.push(remote);
    }
    run_git_owned(&cwd, &args)
}

#[tauri::command]
pub fn git_remotes(cwd: String) -> Result<Vec<GitRemote>, String> {
    let cwd = normalize_cwd(&cwd)?;
    let output = run_git(&cwd, &["remote", "-v"])?;
    let mut remotes: HashMap<String, GitRemote> = HashMap::new();

    for line in output.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 3 {
            continue;
        }
        let name = parts[0].to_string();
        let url = parts[1].to_string();
        let kind = parts[2].trim_matches(|c| c == '(' || c == ')');

        let entry = remotes.entry(name.clone()).or_insert(GitRemote {
            name,
            fetch_url: None,
            push_url: None,
        });

        if kind == "fetch" {
            entry.fetch_url = Some(url);
        } else if kind == "push" {
            entry.push_url = Some(url);
        }
    }

    let mut values: Vec<GitRemote> = remotes.into_values().collect();
    values.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(values)
}

#[tauri::command]
pub fn git_file_view(
    cwd: String,
    path: String,
    old_path: Option<String>,
    index_status: String,
    worktree_status: String,
    staged: bool,
) -> Result<GitFileView, String> {
    let cwd = normalize_cwd(&cwd)?;
    let root = repo_root(&cwd).ok_or_else(|| "Not a git repository".to_string())?;

    let index_char = index_status.chars().next().unwrap_or(' ');
    let worktree_char = worktree_status.chars().next().unwrap_or(' ');
    let old_path = old_path.unwrap_or_else(|| path.clone());

    let (original, modified) = if staged {
        match index_char {
            'A' | 'C' => (String::new(), git_show(&cwd, &format!(":{}", path))),
            'D' => (git_show(&cwd, &format!("HEAD:{}", old_path)), String::new()),
            'R' => (
                git_show(&cwd, &format!("HEAD:{}", old_path)),
                git_show(&cwd, &format!(":{}", path)),
            ),
            _ => (
                git_show(&cwd, &format!("HEAD:{}", path)),
                git_show(&cwd, &format!(":{}", path)),
            ),
        }
    } else {
        match worktree_char {
            '?' => (String::new(), read_worktree_file(&root, &path)),
            'D' => (git_show(&cwd, &format!(":{}", path)), String::new()),
            'R' => (
                git_show(&cwd, &format!(":{}", old_path)),
                read_worktree_file(&root, &path),
            ),
            _ => (
                git_show(&cwd, &format!(":{}", path)),
                read_worktree_file(&root, &path),
            ),
        }
    };

    Ok(GitFileView { original, modified })
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
