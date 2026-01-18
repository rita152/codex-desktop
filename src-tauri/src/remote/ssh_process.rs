//! SSH process management for running codex-acp on remote servers.

use super::types::{RemoteServerConfig, SshAuth};
use anyhow::{anyhow, Context, Result};
use std::path::Path;
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
        local_codex_home: &Path,
        api_key: Option<(&str, &str)>,
    ) -> Result<Self> {
        sync_codex_home(config, local_codex_home).await?;

        let mut cmd = Command::new("ssh");

        // SSH connection parameters
        apply_ssh_options(&mut cmd, config, "-p")?;
        cmd.arg("-o").arg("ServerAliveInterval=15");
        cmd.arg("-o").arg("ServerAliveCountMax=3");

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
    fn build_remote_command(remote_cwd: &str, api_key: Option<(&str, &str)>) -> String {
        // Set environment variables and start codex-acp
        // NO_BROWSER=1 disables ChatGPT browser login (not available remotely)
        let mut env_prefix = String::from("CODEX_HOME=\"$HOME/.codex\" ");
        if let Some((key, value)) = api_key {
            if !value.is_empty() {
                let escaped = shell_escape(value);
                env_prefix.reserve(key.len() + escaped.len() + 2);
                env_prefix.push_str(key);
                env_prefix.push('=');
                env_prefix.push_str(&escaped);
                env_prefix.push(' ');
            }
        }
        let spec = std::env::var("CODEX_DESKTOP_ACP_NPX_SPEC")
            .unwrap_or_else(|_| "@zed-industries/codex-acp@0.8.2".to_string());
        format!(
            "cd {} && {}NO_BROWSER=1 npx --yes {}",
            shell_escape(remote_cwd),
            env_prefix,
            shell_escape(&spec)
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
    // Wrap with single quotes and escape internal single quotes.
    let quote_count = s.as_bytes().iter().filter(|b| **b == b'\'').count();
    if quote_count == 0 {
        let mut out = String::with_capacity(s.len() + 2);
        out.push('\'');
        out.push_str(s);
        out.push('\'');
        return out;
    }

    let mut out = String::with_capacity(s.len() + 2 + (quote_count * 3));
    out.push('\'');
    for ch in s.chars() {
        if ch == '\'' {
            out.push_str("'\\''");
        } else {
            out.push(ch);
        }
    }
    out.push('\'');
    out
}

fn apply_ssh_options(cmd: &mut Command, config: &RemoteServerConfig, port_flag: &str) -> Result<()> {
    cmd.arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg("BatchMode=yes")
        .arg("-o")
        .arg("ConnectTimeout=10")
        .arg(port_flag)
        .arg(config.port.to_string());

    match &config.auth {
        SshAuth::KeyFile {
            private_key_path, ..
        } => {
            cmd.arg("-i").arg(private_key_path);
        }
        SshAuth::Agent => {}
        SshAuth::Password { .. } => {
            return Err(anyhow!(
                "Password authentication is not supported, please use SSH keys"
            ));
        }
    }
    Ok(())
}

async fn sync_codex_home(config: &RemoteServerConfig, local_codex_home: &Path) -> Result<()> {
    if !local_codex_home.exists() {
        return Err(anyhow!(
            "Local CODEX_HOME not found at {}",
            local_codex_home.display()
        ));
    }

    let remote_host = format!("{}@{}", config.username, config.host);
    let remote_path = "$HOME/.codex";

    let mut mkdir_cmd = Command::new("ssh");
    apply_ssh_options(&mut mkdir_cmd, config, "-p")?;
    mkdir_cmd
        .arg(&remote_host)
        .arg(format!("mkdir -p \"{}\"", remote_path));
    let status = mkdir_cmd
        .status()
        .await
        .context("Failed to create remote CODEX_HOME")?;
    if !status.success() {
        return Err(anyhow!(
            "Failed to create remote CODEX_HOME at {}",
            remote_path
        ));
    }

    let auth_exists = remote_file_exists(config, &remote_host, "$HOME/.codex/auth.json").await?;
    let config_exists =
        remote_file_exists(config, &remote_host, "$HOME/.codex/config.toml").await?;
    if auth_exists && config_exists {
        return Ok(());
    }

    let candidates = ["auth.json", "config.toml"];
    let mut missing_local = Vec::new();
    for filename in candidates {
        let should_copy = match filename {
            "auth.json" => !auth_exists,
            "config.toml" => !config_exists,
            _ => false,
        };
        if !should_copy {
            continue;
        }
        let source = local_codex_home.join(filename);
        if !source.exists() {
            missing_local.push(filename);
            continue;
        }
        let destination = format!("{}:~/.codex/{}", remote_host, filename);
        let mut scp_cmd = Command::new("scp");
        apply_ssh_options(&mut scp_cmd, config, "-P")?;
        scp_cmd.arg(source).arg(destination);
        let status = scp_cmd
            .status()
            .await
            .with_context(|| format!("Failed to copy {} to remote", filename))?;
        if !status.success() {
            return Err(anyhow!("Failed to copy {} to remote", filename));
        }
    }

    if !missing_local.is_empty() {
        return Err(anyhow!(
            "Missing local Codex config files: {} (from {})",
            missing_local.join(", "),
            local_codex_home.display()
        ));
    }

    Ok(())
}

async fn remote_file_exists(
    config: &RemoteServerConfig,
    remote_host: &str,
    remote_path: &str,
) -> Result<bool> {
    let mut cmd = Command::new("ssh");
    apply_ssh_options(&mut cmd, config, "-p")?;
    cmd.arg(remote_host)
        .arg(format!("test -f \"{}\"", remote_path));
    let status = cmd.status().await.context("Failed to check remote file")?;
    Ok(status.success())
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
