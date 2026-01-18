//! Data structures for remote server configuration.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Remote server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteServerConfig {
    /// Server unique identifier
    pub id: String,
    /// Server name (user-defined display name)
    pub name: String,
    /// SSH host address
    pub host: String,
    /// SSH port (default 22)
    #[serde(default = "default_ssh_port")]
    pub port: u16,
    /// Username
    pub username: String,
    /// Authentication method
    pub auth: SshAuth,
}

fn default_ssh_port() -> u16 {
    22
}

/// SSH authentication method
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SshAuth {
    /// SSH key file authentication
    KeyFile {
        private_key_path: PathBuf,
        #[serde(default)]
        passphrase: Option<String>,
    },
    /// SSH Agent authentication (recommended)
    Agent,
    /// Password authentication (not recommended)
    Password { password: String },
}

/// Remote session configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteSessionConfig {
    /// Server ID
    pub server_id: String,
    /// Remote working directory
    pub remote_cwd: String,
}
