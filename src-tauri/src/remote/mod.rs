//! Remote server connection module for Codex Desktop.
//!
//! This module implements SSH-based remote server connections,
//! allowing codex-acp to run on remote servers while communicating
//! via SSH tunnels.

pub mod commands;
pub mod ssh_process;
pub mod types;

pub use commands::RemoteServerManager;
pub use ssh_process::RemoteSshProcess;
pub use types::*;
