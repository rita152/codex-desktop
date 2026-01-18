//! Unified process abstraction for local and remote codex-acp processes.

use crate::codex::process::CodexProcess;
use crate::remote::RemoteSshProcess;
use anyhow::Result;
use tokio::process::{ChildStdin, ChildStdout};

/// Unified process wrapper that can be either a local or remote codex-acp process
pub enum UnifiedProcess {
    Local(CodexProcess),
    Remote(RemoteSshProcess),
}

impl UnifiedProcess {
    /// Take ownership of the child stdin/stdout handles
    pub fn take_stdio(&mut self) -> Result<(ChildStdin, ChildStdout)> {
        match self {
            UnifiedProcess::Local(process) => process.take_stdio(),
            UnifiedProcess::Remote(process) => process.take_stdio(),
        }
    }

    /// Check if the process is alive
    pub fn is_alive(&mut self) -> bool {
        match self {
            UnifiedProcess::Local(process) => process.is_alive(),
            UnifiedProcess::Remote(process) => process.is_alive(),
        }
    }

    /// Terminate the process
    pub async fn kill(&mut self) -> Result<()> {
        match self {
            UnifiedProcess::Local(process) => process.kill().await,
            UnifiedProcess::Remote(process) => process.kill().await,
        }
    }
}
