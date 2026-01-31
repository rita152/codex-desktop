//! Resolve and spawn the codex-acp binary.

use anyhow::{anyhow, Context, Result};
use std::{
    ffi::OsString,
    path::{Path, PathBuf},
    process::Stdio,
};
use tauri::Manager;
use tokio::process::Command;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
/// Launch strategy for the codex-acp binary.
pub enum CodexAcpLaunchMode {
    /// Use `npx` to resolve and run codex-acp.
    Npx,
    /// Use a bundled sidecar binary.
    Sidecar,
}

impl CodexAcpLaunchMode {
    /// Resolve the launch mode from `CODEX_DESKTOP_ACP_MODE`, if set.
    pub fn from_env() -> Option<Self> {
        let value = std::env::var("CODEX_DESKTOP_ACP_MODE").ok()?;
        let trimmed = value.trim();
        if trimmed.eq_ignore_ascii_case("npx") {
            Some(Self::Npx)
        } else if trimmed.eq_ignore_ascii_case("sidecar") {
            Some(Self::Sidecar)
        } else {
            None
        }
    }

    /// Pick a default launch mode based on build type.
    /// In debug mode, prefers local sidecar binary if available for faster startup.
    pub fn default_for_build() -> Self {
        if cfg!(debug_assertions) {
            // In debug mode, check if local sidecar binary exists for faster startup
            if Self::has_local_sidecar() {
                Self::Sidecar
            } else {
                Self::Npx
            }
        } else {
            Self::Sidecar
        }
    }

    /// Check if a local sidecar binary exists (for debug mode optimization)
    fn has_local_sidecar() -> bool {
        // Check explicit path first
        if let Ok(path) = std::env::var("CODEX_DESKTOP_ACP_PATH") {
            return std::path::Path::new(&path).exists();
        }

        // Check common local development paths
        let local_paths = [
            "codex-acp/target/release/codex-acp",
            "../codex-acp/target/release/codex-acp",
        ];

        for path in &local_paths {
            if std::path::Path::new(path).exists() {
                return true;
            }
        }

        false
    }
}

#[derive(Debug, Clone)]
/// Resolved codex-acp program path and args.
pub struct CodexAcpBinary {
    /// Launch mode used to resolve this binary.
    pub mode: CodexAcpLaunchMode,
    program: OsString,
    args: Vec<OsString>,
}

impl CodexAcpBinary {
    /// Resolve the codex-acp binary using environment overrides.
    pub fn resolve(app: Option<&tauri::AppHandle>) -> Result<Self> {
        let mode =
            CodexAcpLaunchMode::from_env().unwrap_or_else(CodexAcpLaunchMode::default_for_build);
        Self::resolve_with_mode(mode, app)
    }

    /// Resolve the codex-acp binary using an explicit launch mode.
    pub fn resolve_with_mode(
        mode: CodexAcpLaunchMode,
        app: Option<&tauri::AppHandle>,
    ) -> Result<Self> {
        match mode {
            CodexAcpLaunchMode::Npx => Ok(Self::npx()),
            CodexAcpLaunchMode::Sidecar => Self::sidecar(app),
        }
    }

    /// Format a human-readable diagnostics line for logging.
    pub fn diagnostics_line(&self) -> String {
        use std::fmt::Write as _;

        let mut s = String::new();
        let _ = write!(
            s,
            "codex-acp spawn: mode={:?} program={}",
            self.mode,
            self.program.to_string_lossy()
        );
        if !self.args.is_empty() {
            s.push_str(" args=");
            for (idx, arg) in self.args.iter().enumerate() {
                if idx > 0 {
                    s.push(' ');
                }
                let arg_str = arg.to_string_lossy();
                s.push_str(&arg_str);
            }
        }
        s
    }

    /// Build a command ready to spawn codex-acp.
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
        let program: OsString =
            std::env::var_os("CODEX_DESKTOP_NPX_BIN").unwrap_or_else(|| OsString::from("npx"));
        let spec = std::env::var_os("CODEX_DESKTOP_ACP_NPX_SPEC")
            .unwrap_or_else(|| OsString::from("@zed-industries/codex-acp@0.9.0"));
        Self {
            mode: CodexAcpLaunchMode::Npx,
            program,
            args: vec![OsString::from("--yes"), spec],
        }
    }

    fn sidecar(app: Option<&tauri::AppHandle>) -> Result<Self> {
        // 1. Check explicit path override
        if let Some(explicit) = std::env::var_os("CODEX_DESKTOP_ACP_PATH") {
            return Ok(Self {
                mode: CodexAcpLaunchMode::Sidecar,
                program: explicit,
                args: Vec::new(),
            });
        }

        // 2. In debug mode, check local development paths first
        if cfg!(debug_assertions) {
            let local_paths = [
                PathBuf::from("codex-acp/target/release/codex-acp"),
                PathBuf::from("../codex-acp/target/release/codex-acp"),
            ];

            for path in &local_paths {
                if path.exists() {
                    tracing::info!("Using local codex-acp binary: {}", path.display());
                    return Ok(Self {
                        mode: CodexAcpLaunchMode::Sidecar,
                        program: path.clone().into_os_string(),
                        args: Vec::new(),
                    });
                }
            }
        }

        // 3. Use bundled sidecar (requires AppHandle)
        let app =
            app.context("sidecar mode requires a Tauri AppHandle (or set CODEX_DESKTOP_ACP_PATH)")?;
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
            macos_macos_dir(&resource_dir)
                .map(|d| d.join(&exe_name))
                .unwrap_or_default(),
        ];

        let found = candidates
            .into_iter()
            .find(|p| !p.as_os_str().is_empty() && p.exists());
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

    /// Resolve the default Codex home directory based on environment and app data.
    pub fn default_codex_home(app: Option<&tauri::AppHandle>) -> Result<PathBuf> {
        if let Some(explicit) =
            std::env::var_os("CODEX_DESKTOP_CODEX_HOME").or_else(|| std::env::var_os("CODEX_HOME"))
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
