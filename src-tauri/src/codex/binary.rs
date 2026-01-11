use anyhow::{anyhow, Context, Result};
use std::{
    ffi::OsString,
    path::{Path, PathBuf},
    process::Stdio,
};
use tauri::Manager;
use tokio::process::Command;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CodexAcpLaunchMode {
    Npx,
    Sidecar,
}

impl CodexAcpLaunchMode {
    pub fn from_env() -> Option<Self> {
        match std::env::var("CODEX_DESKTOP_ACP_MODE")
            .ok()
            .as_deref()
            .map(str::trim)
            .map(str::to_ascii_lowercase)
            .as_deref()
        {
            Some("npx") => Some(Self::Npx),
            Some("sidecar") => Some(Self::Sidecar),
            Some(_) | None => None,
        }
    }

    pub fn default_for_build() -> Self {
        if cfg!(debug_assertions) {
            Self::Npx
        } else {
            Self::Sidecar
        }
    }
}

#[derive(Debug, Clone)]
pub struct CodexAcpBinary {
    pub mode: CodexAcpLaunchMode,
    program: OsString,
    args: Vec<OsString>,
}

impl CodexAcpBinary {
    pub fn resolve(app: Option<&tauri::AppHandle>) -> Result<Self> {
        let mode = CodexAcpLaunchMode::from_env().unwrap_or_else(CodexAcpLaunchMode::default_for_build);
        Self::resolve_with_mode(mode, app)
    }

    pub fn resolve_with_mode(mode: CodexAcpLaunchMode, app: Option<&tauri::AppHandle>) -> Result<Self> {
        match mode {
            CodexAcpLaunchMode::Npx => Ok(Self::npx()),
            CodexAcpLaunchMode::Sidecar => Self::sidecar(app),
        }
    }

    pub fn diagnostics_line(&self) -> String {
        let mut s = format!("codex-acp spawn: mode={:?} program={}", self.mode, self.program.to_string_lossy());
        if !self.args.is_empty() {
            s.push_str(" args=");
            s.push_str(
                &self
                    .args
                    .iter()
                    .map(|a| a.to_string_lossy().into_owned())
                    .collect::<Vec<_>>()
                    .join(" "),
            );
        }
        s
    }

    pub fn command(&self, codex_home: &Path) -> Command {
        let mut cmd = Command::new(&self.program);
        cmd.args(&self.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .env("CODEX_HOME", codex_home);
        cmd
    }

    fn npx() -> Self {
        let program: OsString = std::env::var_os("CODEX_DESKTOP_NPX_BIN").unwrap_or_else(|| OsString::from("npx"));
        let spec = std::env::var_os("CODEX_DESKTOP_ACP_NPX_SPEC").unwrap_or_else(|| OsString::from("@zed-industries/codex-acp"));
        Self {
            mode: CodexAcpLaunchMode::Npx,
            program,
            args: vec![spec],
        }
    }

    fn sidecar(app: Option<&tauri::AppHandle>) -> Result<Self> {
        if let Some(explicit) = std::env::var_os("CODEX_DESKTOP_ACP_PATH") {
            return Ok(Self {
                mode: CodexAcpLaunchMode::Sidecar,
                program: explicit,
                args: Vec::new(),
            });
        }

        let app = app.context("sidecar mode requires a Tauri AppHandle (or set CODEX_DESKTOP_ACP_PATH)")?;
        let resource_dir = app
            .path()
            .resource_dir()
            .context("failed to resolve app resource_dir for sidecar")?;

        let sidecar_name = std::env::var("CODEX_DESKTOP_ACP_SIDECAR_NAME")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "codex-acp".to_string());

        let exe_name = format!("{sidecar_name}{}", std::env::consts::EXE_SUFFIX);
        let candidate = resource_dir.join(exe_name);
        if !candidate.exists() {
            return Err(anyhow!(
                "codex-acp sidecar not found at {} (set CODEX_DESKTOP_ACP_PATH to override)",
                candidate.display()
            ));
        }

        Ok(Self {
            mode: CodexAcpLaunchMode::Sidecar,
            program: candidate.into_os_string(),
            args: Vec::new(),
        })
    }

    pub fn default_codex_home() -> Result<PathBuf> {
        let home = std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .context("HOME/USERPROFILE not set; set CODEX_HOME explicitly")?;
        Ok(PathBuf::from(home).join(".codex"))
    }
}
