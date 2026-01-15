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
pub struct CodexProcessConfig {
    pub mode: Option<CodexAcpLaunchMode>,
    pub codex_home: Option<PathBuf>,
    pub cwd: Option<PathBuf>,
    pub env: BTreeMap<OsString, OsString>,
}

impl CodexProcessConfig {
    pub fn codex_home_or_default(&self, app: Option<&AppHandle>) -> Result<PathBuf> {
        self.codex_home
            .clone()
            .map(Ok)
            .unwrap_or_else(|| CodexAcpBinary::default_codex_home(app))
    }

    pub fn set_env<K: Into<OsString>, V: Into<OsString>>(&mut self, key: K, value: V) {
        self.env.insert(key.into(), value.into());
    }

    pub fn set_env_if_missing<K: AsRef<OsStr>, V: Into<OsString>>(&mut self, key: K, value: V) {
        if !self.env.contains_key(key.as_ref()) {
            self.env.insert(key.as_ref().to_os_string(), value.into());
        }
    }
}

pub struct CodexProcess {
    child: Child,
    stdin: Option<ChildStdin>,
    stdout: Option<ChildStdout>,
}

impl CodexProcess {
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

    pub fn take_stdio(&mut self) -> Result<(ChildStdin, ChildStdout)> {
        let stdin = self.stdin.take().context("stdin already taken")?;
        let stdout = self.stdout.take().context("stdout already taken")?;
        Ok((stdin, stdout))
    }

    pub fn is_alive(&mut self) -> bool {
        match self.child.try_wait() {
            Ok(Some(_)) => false,
            Ok(None) => true,
            Err(_) => false,
        }
    }

    pub async fn kill(&mut self) -> Result<()> {
        if self.is_alive() {
            let _ = self.child.kill().await;
        }
        let _ = self.child.wait().await;
        Ok(())
    }

    pub async fn wait(&mut self) -> Result<()> {
        let _ = self.child.wait().await?;
        Ok(())
    }

    pub fn pid(&self) -> Option<u32> {
        self.child.id()
    }
}

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
