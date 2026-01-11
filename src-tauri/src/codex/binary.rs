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
        let spec = std::env::var_os("CODEX_DESKTOP_ACP_NPX_SPEC")
            .unwrap_or_else(|| OsString::from("@zed-industries/codex-acp@0.8.2"));
        Self {
            mode: CodexAcpLaunchMode::Npx,
            program,
            args: vec![OsString::from("--yes"), spec],
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

        let candidates = [
            resource_dir.join(&exe_name),
            resource_dir.join("bin").join(&exe_name),
            macos_macos_dir(&resource_dir).map(|d| d.join(&exe_name)).unwrap_or_default(),
        ];

        let found = candidates.into_iter().find(|p| !p.as_os_str().is_empty() && p.exists());
        let Some(candidate) = found else {
            return Err(anyhow!(
                "codex-acp sidecar not found (looked for {}) (set CODEX_DESKTOP_ACP_PATH to override)",
                resource_dir.display()
            ));
        };

        Ok(Self {
            mode: CodexAcpLaunchMode::Sidecar,
            program: candidate.into_os_string(),
            args: Vec::new(),
        })
    }

    pub fn default_codex_home(app: Option<&tauri::AppHandle>) -> Result<PathBuf> {
        if let Some(explicit) = std::env::var_os("CODEX_DESKTOP_CODEX_HOME").or_else(|| std::env::var_os("CODEX_HOME"))
        {
            return Ok(PathBuf::from(explicit));
        }

        if !cfg!(debug_assertions) {
            if let Some(app) = app {
                if let Ok(dir) = app.path().app_data_dir() {
                    return Ok(dir.join("codex"));
                }
            }
        }

        let home = std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .context("HOME/USERPROFILE not set; set CODEX_HOME explicitly")?;
        Ok(PathBuf::from(home).join(".codex"))
    }
}

fn macos_macos_dir(resource_dir: &Path) -> Option<PathBuf> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    // For macOS bundles, resources live at `Contents/Resources` and binaries at `Contents/MacOS`.
    let contents = resource_dir.parent()?;
    Some(contents.join("MacOS"))
}
