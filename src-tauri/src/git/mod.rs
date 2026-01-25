//! Git integration helpers and Tauri commands.

pub mod commands;
pub mod types;

use std::path::Path;
use std::process::Command;

fn validate_cwd(cwd: &Path) -> Result<(), String> {
    if !cwd.exists() {
        return Err(format!("Path does not exist: {}", cwd.display()));
    }
    if !cwd.is_dir() {
        return Err(format!("Path is not a directory: {}", cwd.display()));
    }
    Ok(())
}

fn run_git_command(mut cmd: Command) -> Result<String, String> {
    let output = cmd
        .output()
        .map_err(|err| format!("Failed to execute git: {}", err))?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            Err("Git command failed with no output".to_string())
        } else {
            Err(stdout)
        }
    } else {
        Err(stderr)
    }
}

/// Run a git command in the provided working directory.
pub fn run_git(cwd: &Path, args: &[&str]) -> Result<String, String> {
    validate_cwd(cwd)?;
    let mut cmd = Command::new("git");
    cmd.current_dir(cwd).args(args);
    run_git_command(cmd)
}

/// Run a git command in the provided working directory with owned args.
pub fn run_git_owned(cwd: &Path, args: &[String]) -> Result<String, String> {
    validate_cwd(cwd)?;
    let mut cmd = Command::new("git");
    cmd.current_dir(cwd).args(args);
    run_git_command(cmd)
}
