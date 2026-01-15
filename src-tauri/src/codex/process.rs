//! Spawn and manage codex-acp child processes.

use crate::codex::binary::{CodexAcpBinary, CodexAcpLaunchMode};
use anyhow::{anyhow, Context, Result};
use std::{
    collections::BTreeMap,
    ffi::{OsStr, OsString},
    path::{Path, PathBuf},
};
use tauri::AppHandle;
use tokio::process::{Child, ChildStdin, ChildStdout};

#[derive(Debug, Clone, Default)]
/// Configuration for spawning a codex-acp process.
pub struct CodexProcessConfig {
    /// Optional launch mode override.
    pub mode: Option<CodexAcpLaunchMode>,
    /// Optional explicit Codex home directory.
    pub codex_home: Option<PathBuf>,
    /// Optional working directory for the child process.
    pub cwd: Option<PathBuf>,
    /// Extra environment variables to set on the child process.
    pub env: BTreeMap<OsString, OsString>,
}

impl CodexProcessConfig {
    /// Resolve the codex home directory for this config.
    pub fn codex_home_or_default(&self, app: Option<&AppHandle>) -> Result<PathBuf> {
        self.codex_home
            .clone()
            .map(Ok)
            .unwrap_or_else(|| CodexAcpBinary::default_codex_home(app))
    }

    /// Insert or replace an environment variable for the child process.
    pub fn set_env<K: Into<OsString>, V: Into<OsString>>(&mut self, key: K, value: V) {
        self.env.insert(key.into(), value.into());
    }

    /// Set an environment variable if it has not already been configured.
    pub fn set_env_if_missing<K: AsRef<OsStr>, V: Into<OsString>>(&mut self, key: K, value: V) {
        if !self.env.contains_key(key.as_ref()) {
            self.env.insert(key.as_ref().to_os_string(), value.into());
        }
    }
}

/// Spawned codex-acp process with captured stdio.
pub struct CodexProcess {
    child: Child,
    stdin: Option<ChildStdin>,
    stdout: Option<ChildStdout>,
}

impl CodexProcess {
    /// Spawn a codex-acp process with the provided config.
    pub async fn spawn(app: Option<&AppHandle>, cfg: CodexProcessConfig) -> Result<Self> {
        let codex_home = cfg.codex_home_or_default(app)?;
        let mode = cfg
            .mode
            .unwrap_or_else(CodexAcpLaunchMode::default_for_build);
        let binary = CodexAcpBinary::resolve_with_mode(mode, app)?;

        tracing::info!(message = %binary.diagnostics_line(), "codex-acp diagnostics");

        let mut cmd = binary.command(&codex_home);
        if let Some(cwd) = cfg.cwd.as_ref() {
            cmd.current_dir(cwd);
        }
        for (k, v) in cfg.env {
            cmd.env(k, v);
        }

        let mut child = cmd.spawn().context("failed to spawn codex-acp")?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow!("codex-acp stdin unavailable"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("codex-acp stdout unavailable"))?;

        Ok(Self {
            child,
            stdin: Some(stdin),
            stdout: Some(stdout),
        })
    }

    /// Take ownership of the child stdin/stdout handles.
    pub fn take_stdio(&mut self) -> Result<(ChildStdin, ChildStdout)> {
        let stdin = self.stdin.take().context("stdin already taken")?;
        let stdout = self.stdout.take().context("stdout already taken")?;
        Ok((stdin, stdout))
    }

    /// Return true if the child process is still running.
    pub fn is_alive(&mut self) -> bool {
        match self.child.try_wait() {
            Ok(Some(_)) => false,
            Ok(None) => true,
            Err(_) => false,
        }
    }

    /// Terminate the child process if it is still running.
    pub async fn kill(&mut self) -> Result<()> {
        if self.is_alive() {
            let _ = self.child.kill().await;
        }
        let _ = self.child.wait().await;
        Ok(())
    }

    /// Wait for the child process to exit.
    pub async fn wait(&mut self) -> Result<()> {
        let _ = self.child.wait().await?;
        Ok(())
    }

    /// Return the OS process id of the child process.
    pub fn pid(&self) -> Option<u32> {
        self.child.id()
    }
}

/// Resolve a working directory, accepting absolute or relative paths.
pub fn resolve_cwd(cwd: impl AsRef<Path>) -> Result<PathBuf> {
    let cwd = cwd.as_ref();
    if cwd.as_os_str().is_empty() {
        return std::env::current_dir().context("failed to resolve current_dir");
    }
    if cwd.is_absolute() {
        return Ok(cwd.to_path_buf());
    }
    Ok(std::env::current_dir()
        .context("failed to resolve current_dir")?
        .join(cwd))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore = "requires a working codex-acp spawn strategy (npx or sidecar)"]
    async fn test_spawn_and_kill() -> Result<()> {
        let cfg = CodexProcessConfig {
            mode: Some(CodexAcpLaunchMode::Npx),
            ..Default::default()
        };
        let mut process = CodexProcess::spawn(None, cfg).await?;
        assert!(process.is_alive());
        process.kill().await?;
        assert!(!process.is_alive());
        Ok(())
    }
}
