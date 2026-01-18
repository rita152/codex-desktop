//! SSH process management for running codex-acp on remote servers.

use super::types::{RemoteServerConfig, SshAuth};
use anyhow::{anyhow, Context, Result};
use std::process::Stdio;
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

/// Process wrapper for running codex-acp remotely via SSH
pub struct RemoteSshProcess {
    child: Child,
    stdin: Option<ChildStdin>,
    stdout: Option<ChildStdout>,
}

impl RemoteSshProcess {
    /// Establish SSH connection and start codex-acp on remote server
    pub async fn spawn(
        config: &RemoteServerConfig,
        remote_cwd: &str,
        api_key: &str,
    ) -> Result<Self> {
        let mut cmd = Command::new("ssh");

        // SSH connection parameters
        cmd.arg("-o")
            .arg("StrictHostKeyChecking=accept-new")
            .arg("-o")
            .arg("BatchMode=yes")
            .arg("-o")
            .arg("ServerAliveInterval=15")
            .arg("-o")
            .arg("ServerAliveCountMax=3")
            .arg("-p")
            .arg(config.port.to_string());

        // Authentication method
        match &config.auth {
            SshAuth::KeyFile {
                private_key_path, ..
            } => {
                cmd.arg("-i").arg(private_key_path);
            }
            SshAuth::Agent => {
                // Use system SSH Agent, no additional arguments needed
            }
            SshAuth::Password { .. } => {
                // Password authentication requires sshpass or similar
                // Not supported for now, recommend using key authentication
                return Err(anyhow!(
                    "Password authentication is not supported, please use SSH keys"
                ));
            }
        }

        // user@host
        cmd.arg(format!("{}@{}", config.username, config.host));

        // Remote command to execute
        let remote_command = Self::build_remote_command(remote_cwd, api_key);
        cmd.arg(remote_command);

        // Configure stdio
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit()); // stderr displayed in local terminal for debugging

        tracing::info!(
            "Starting remote codex-acp on {}@{}:{}",
            config.username,
            config.host,
            config.port
        );

        let mut child = cmd
            .spawn()
            .context("Failed to start SSH process, ensure ssh command is available")?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow!("Failed to get SSH stdin"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("Failed to get SSH stdout"))?;

        Ok(Self {
            child,
            stdin: Some(stdin),
            stdout: Some(stdout),
        })
    }

    /// Build the remote command to execute
    fn build_remote_command(remote_cwd: &str, api_key: &str) -> String {
        // Set environment variables and start codex-acp
        // NO_BROWSER=1 disables ChatGPT browser login (not available remotely)
        format!(
            "cd {} && OPENAI_API_KEY='{}' NO_BROWSER=1 npx @zed-industries/codex-acp 2>/dev/null",
            shell_escape(remote_cwd),
            api_key
        )
    }

    /// Get stdin/stdout for ACP communication
    pub fn take_stdio(&mut self) -> Result<(ChildStdin, ChildStdout)> {
        let stdin = self
            .stdin
            .take()
            .ok_or_else(|| anyhow!("stdin already taken"))?;
        let stdout = self
            .stdout
            .take()
            .ok_or_else(|| anyhow!("stdout already taken"))?;
        Ok((stdin, stdout))
    }

    /// Check if process is alive
    pub fn is_alive(&mut self) -> bool {
        match self.child.try_wait() {
            Ok(Some(_)) => false,
            Ok(None) => true,
            Err(_) => false,
        }
    }

    /// Terminate the process
    pub async fn kill(&mut self) -> Result<()> {
        if self.is_alive() {
            let _ = self.child.kill().await;
        }
        let _ = self.child.wait().await;
        Ok(())
    }
}

/// Simple shell escaping
fn shell_escape(s: &str) -> String {
    // Wrap with single quotes and escape internal single quotes
    format!("'{}'", s.replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shell_escape() {
        assert_eq!(shell_escape("simple"), "'simple'");
        assert_eq!(shell_escape("with space"), "'with space'");
        assert_eq!(shell_escape("with'quote"), "'with'\\''quote'");
        assert_eq!(
            shell_escape("/path/to/dir"),
            "'/path/to/dir'"
        );
    }
}
