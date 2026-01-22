//! Tauri commands for remote server management.

use super::types::*;
use anyhow::anyhow;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::{env, fs};
use std::sync::RwLock;
use tauri::State;
use tracing::warn;

/// Remote server manager
pub struct RemoteServerManager {
    servers: RwLock<HashMap<String, RemoteServerConfig>>,
    config_path: std::path::PathBuf,
}

impl RemoteServerManager {
    pub fn new(config_path: std::path::PathBuf) -> Self {
        Self {
            servers: RwLock::new(HashMap::new()),
            config_path,
        }
    }

    pub fn add(&self, config: RemoteServerConfig) -> anyhow::Result<()> {
        Err(anyhow!(
            "Remote servers are managed via ~/.ssh/config (add {} there)",
            config.name
        ))
    }

    pub fn remove(&self, id: &str) -> anyhow::Result<()> {
        Err(anyhow!(
            "Remote servers are managed via ~/.ssh/config (remove {} there)",
            id
        ))
    }

    pub fn list(&self) -> Vec<RemoteServerConfig> {
        self.refresh_from_ssh_config()
    }

    pub fn get(&self, id: &str) -> Option<RemoteServerConfig> {
        self.refresh_from_ssh_config();
        let servers = self.servers.read().unwrap();
        servers.get(id).cloned()
    }

    fn refresh_from_ssh_config(&self) -> Vec<RemoteServerConfig> {
        let list = match load_ssh_config() {
            Ok(list) => list,
            Err(err) => {
                warn!(error = %err, "failed to load ~/.ssh/config");
                Vec::new()
            }
        };
        let mut servers = self.servers.write().unwrap();
        servers.clear();
        servers.reserve(list.len());
        for config in &list {
            servers.insert(config.id.clone(), config.clone());
        }
        list
    }
}

#[derive(Default, Clone)]
struct SshOptions {
    hostname: Option<String>,
    user: Option<String>,
    port: Option<u16>,
    identity_file: Option<PathBuf>,
}

impl SshOptions {
    fn apply_key(&mut self, key: &str, value: &str, base_dir: &Path) {
        match key {
            "hostname" => {
                if !value.is_empty() {
                    self.hostname = Some(value.to_string());
                }
            }
            "user" => {
                if !value.is_empty() {
                    self.user = Some(value.to_string());
                }
            }
            "port" => {
                if let Ok(port) = value.parse::<u16>() {
                    self.port = Some(port);
                }
            }
            "identityfile" => {
                if self.identity_file.is_none() && !value.is_empty() {
                    self.identity_file = Some(expand_path(value, base_dir));
                }
            }
            _ => {}
        }
    }

    fn merge_from(&mut self, other: &SshOptions) {
        if let Some(hostname) = &other.hostname {
            self.hostname = Some(hostname.clone());
        }
        if let Some(user) = &other.user {
            self.user = Some(user.clone());
        }
        if let Some(port) = other.port {
            self.port = Some(port);
        }
        if let Some(identity_file) = &other.identity_file {
            self.identity_file = Some(identity_file.clone());
        }
    }
}

#[derive(Clone)]
struct SshHostBlock {
    patterns: Vec<String>,
    options: SshOptions,
}

fn load_ssh_config() -> anyhow::Result<Vec<RemoteServerConfig>> {
    let home_dir = dirs::home_dir().ok_or_else(|| anyhow!("home directory not found"))?;
    let config_path = home_dir.join(".ssh").join("config");
    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let mut blocks: Vec<SshHostBlock> = Vec::new();
    let mut pre_host_options = SshOptions::default();
    let mut visited = HashSet::new();
    parse_ssh_config_file(&config_path, &mut pre_host_options, &mut blocks, &mut visited)?;

    let mut aliases: Vec<String> = Vec::new();
    for block in &blocks {
        for pattern in &block.patterns {
            if is_plain_host(pattern) && !aliases.contains(pattern) {
                aliases.push(pattern.clone());
            }
        }
    }

    let default_user = default_username();
    let mut result = Vec::with_capacity(aliases.len());
    for alias in aliases {
        let mut options = pre_host_options.clone();
        for block in &blocks {
            if host_matches(&block.patterns, &alias) {
                options.merge_from(&block.options);
            }
        }
        let host = options.hostname.clone().unwrap_or_else(|| alias.clone());
        let username = options.user.clone().unwrap_or_else(|| default_user.clone());
        let port = options.port.unwrap_or(22);
        let auth = match options.identity_file.clone() {
            Some(path) => SshAuth::KeyFile {
                private_key_path: path,
                passphrase: None,
            },
            None => SshAuth::Agent,
        };

        result.push(RemoteServerConfig {
            id: alias.clone(),
            name: alias,
            host,
            port,
            username,
            auth,
        });
    }

    Ok(result)
}

fn parse_ssh_config_file(
    path: &Path,
    pre_host_options: &mut SshOptions,
    blocks: &mut Vec<SshHostBlock>,
    visited: &mut HashSet<PathBuf>,
) -> anyhow::Result<()> {
    let canonical = if path.is_absolute() {
        path.to_path_buf()
    } else {
        fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
    };
    if !visited.insert(canonical.clone()) {
        return Ok(());
    }
    let contents = fs::read_to_string(&canonical)?;
    let base_dir = canonical.parent().unwrap_or_else(|| Path::new("/"));

    let mut current_block: Option<SshHostBlock> = None;
    let mut in_match_block = false;

    for raw_line in contents.lines() {
        let line = strip_comments(raw_line);
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let (key, value) = match parse_key_value(line) {
            Some((key, value)) => (key, value),
            None => continue,
        };

        if key == "match" {
            if let Some(block) = current_block.take() {
                blocks.push(block);
            }
            in_match_block = true;
            continue;
        }

        if key == "host" {
            in_match_block = false;
            if let Some(block) = current_block.take() {
                blocks.push(block);
            }
            let patterns = value
                .split_whitespace()
                .map(|pattern| pattern.to_string())
                .collect();
            current_block = Some(SshHostBlock {
                patterns,
                options: SshOptions::default(),
            });
            continue;
        }

        if key == "include" {
            let patterns: Vec<&str> = value.split_whitespace().collect();
            for pattern in patterns {
                for include_path in resolve_include_paths(base_dir, pattern) {
                    let _ = parse_ssh_config_file(&include_path, pre_host_options, blocks, visited);
                }
            }
            continue;
        }

        if in_match_block {
            continue;
        }

        if let Some(block) = current_block.as_mut() {
            block.options.apply_key(&key, &value, base_dir);
        } else {
            pre_host_options.apply_key(&key, &value, base_dir);
        }
    }

    if let Some(block) = current_block.take() {
        blocks.push(block);
    }

    Ok(())
}

fn parse_key_value(line: &str) -> Option<(String, String)> {
    let mut parts = line.splitn(2, |c: char| c.is_whitespace());
    let key = parts.next()?.trim();
    let value = parts.next().unwrap_or("").trim();
    if key.is_empty() || value.is_empty() {
        return None;
    }
    let value = strip_quotes(value);
    Some((key.to_ascii_lowercase(), value.to_string()))
}

fn strip_comments(line: &str) -> &str {
    match line.find('#') {
        Some(index) => &line[..index],
        None => line,
    }
}

fn strip_quotes(value: &str) -> &str {
    let trimmed = value.trim();
    if trimmed.len() >= 2 {
        let bytes = trimmed.as_bytes();
        if (bytes[0] == b'"' && bytes[trimmed.len() - 1] == b'"')
            || (bytes[0] == b'\'' && bytes[trimmed.len() - 1] == b'\'')
        {
            return &trimmed[1..trimmed.len() - 1];
        }
    }
    trimmed
}

fn expand_path(raw: &str, base_dir: &Path) -> PathBuf {
    let trimmed = strip_quotes(raw);
    if trimmed == "~" {
        return dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    }
    if let Some(rest) = trimmed.strip_prefix("~/") {
        return dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("~"))
            .join(rest);
    }
    let path = PathBuf::from(trimmed);
    if path.is_relative() {
        base_dir.join(path)
    } else {
        path
    }
}

fn resolve_include_paths(base_dir: &Path, pattern: &str) -> Vec<PathBuf> {
    let path = expand_path(pattern, base_dir);
    let path_str = path.to_string_lossy();
    if !has_wildcards(&path_str) {
        return if path.exists() { vec![path] } else { Vec::new() };
    }

    let parent = path.parent().unwrap_or(base_dir);
    let file_pattern = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    let mut results = Vec::new();
    if let Ok(entries) = fs::read_dir(parent) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if glob_match(file_pattern, name) {
                    results.push(entry.path());
                }
            }
        }
    }
    results.sort();
    results
}

fn has_wildcards(value: &str) -> bool {
    value.contains('*') || value.contains('?') || value.contains('[') || value.contains(']')
}

fn is_plain_host(pattern: &str) -> bool {
    if pattern.starts_with('!') {
        return false;
    }
    !has_wildcards(pattern)
}

fn host_matches(patterns: &[String], host: &str) -> bool {
    let mut matched = false;
    for pattern in patterns {
        let trimmed = pattern.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(negated) = trimmed.strip_prefix('!') {
            if glob_match(negated, host) {
                return false;
            }
            continue;
        }
        if glob_match(trimmed, host) {
            matched = true;
        }
    }
    matched
}

fn glob_match(pattern: &str, text: &str) -> bool {
    let p = pattern.as_bytes();
    let t = text.as_bytes();
    let p_len = p.len();
    let t_len = t.len();
    let mut dp = vec![vec![false; t_len + 1]; p_len + 1];
    dp[0][0] = true;
    for i in 1..=p_len {
        if p[i - 1] == b'*' {
            dp[i][0] = dp[i - 1][0];
        }
    }
    for i in 1..=p_len {
        for j in 1..=t_len {
            dp[i][j] = match p[i - 1] {
                b'*' => dp[i - 1][j] || dp[i][j - 1],
                b'?' => dp[i - 1][j - 1],
                _ => dp[i - 1][j - 1] && p[i - 1] == t[j - 1],
            };
        }
    }
    dp[p_len][t_len]
}

fn default_username() -> String {
    env::var("USER")
        .or_else(|_| env::var("USERNAME"))
        .unwrap_or_else(|_| "unknown".to_string())
}

// Tauri Commands

#[tauri::command]
pub fn remote_add_server(
    config: RemoteServerConfig,
    manager: State<'_, RemoteServerManager>,
) -> Result<(), String> {
    manager.add(config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remote_remove_server(
    server_id: String,
    manager: State<'_, RemoteServerManager>,
) -> Result<(), String> {
    manager.remove(&server_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remote_list_servers(manager: State<'_, RemoteServerManager>) -> Vec<RemoteServerConfig> {
    manager.list()
}

#[tauri::command]
pub async fn remote_test_connection(
    server_id: String,
    manager: State<'_, RemoteServerManager>,
) -> Result<String, String> {
    let config = manager.get(&server_id).ok_or("Server configuration not found")?;

    // Test connection using ssh
    let mut cmd = tokio::process::Command::new("ssh");
    cmd.arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg("BatchMode=yes")
        .arg("-o")
        .arg("ConnectTimeout=10")
        .arg("-p")
        .arg(config.port.to_string());

    // Add authentication
    match &config.auth {
        SshAuth::KeyFile { private_key_path, .. } => {
            cmd.arg("-i").arg(private_key_path);
        }
        SshAuth::Agent => {}
        SshAuth::Password { .. } => {
            return Err("Password authentication is not supported for connection testing".to_string());
        }
    }

    cmd.arg(format!("{}@{}", config.username, config.host))
        .arg("echo 'connection ok' && node --version 2>/dev/null || echo 'Node.js not found'");

    let output = cmd.output().await.map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(decode_output(output.stdout))
    } else {
        Err(decode_output(output.stderr))
    }
}

#[tauri::command]
pub async fn remote_list_directory(
    server_id: String,
    path: String,
    manager: State<'_, RemoteServerManager>,
) -> Result<RemoteDirectoryListing, String> {
    let config = manager.get(&server_id).ok_or("Server configuration not found")?;
    let trimmed = path.trim();

    // Use $HOME when empty or "~" is provided.
    let (cd_target, use_home) = if trimmed.is_empty() || trimmed == "~" {
        ("$HOME".to_string(), true)
    } else {
        (shell_escape(trimmed), false)
    };

    let remote_command = if use_home {
        "cd $HOME && pwd -P && find . -maxdepth 1 -mindepth 1 -type d -print0".to_string()
    } else {
        format!(
            "cd {} && pwd -P && find . -maxdepth 1 -mindepth 1 -type d -print0",
            cd_target
        )
    };

    let mut cmd = tokio::process::Command::new("ssh");
    cmd.arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg("BatchMode=yes")
        .arg("-o")
        .arg("ConnectTimeout=10")
        .arg("-p")
        .arg(config.port.to_string());

    match &config.auth {
        SshAuth::KeyFile { private_key_path, .. } => {
            cmd.arg("-i").arg(private_key_path);
        }
        SshAuth::Agent => {}
        SshAuth::Password { .. } => {
            return Err("Password authentication is not supported for remote browsing".to_string());
        }
    }

    cmd.arg(format!("{}@{}", config.username, config.host))
        .arg(remote_command);

    let output = cmd.output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(decode_output(output.stderr));
    }

    let stdout = output.stdout;
    let newline = stdout.iter().position(|byte| *byte == b'\n');
    let empty_entries: &[u8] = &[];
    let (path_bytes, entries_bytes) = match newline {
        Some(index) => (&stdout[..index], &stdout[index + 1..]),
        None => (stdout.as_slice(), empty_entries),
    };
    let resolved_path = String::from_utf8_lossy(path_bytes).trim().to_string();
    if resolved_path.is_empty() {
        return Err("Failed to resolve remote path".to_string());
    }

    let prefix = if resolved_path == "/" {
        "/".to_string()
    } else {
        let mut out = String::with_capacity(resolved_path.len() + 1);
        out.push_str(&resolved_path);
        out.push('/');
        out
    };

    let estimated_entries = if entries_bytes.is_empty() {
        0
    } else {
        entries_bytes.iter().filter(|byte| **byte == 0).count() + 1
    };
    let mut entries = Vec::with_capacity(estimated_entries);
    for item in entries_bytes
        .split(|byte| *byte == 0)
        .filter(|item| !item.is_empty())
    {
        let raw = String::from_utf8_lossy(item);
        let name = raw.strip_prefix("./").unwrap_or(&raw);
        let mut full_path = String::with_capacity(prefix.len() + name.len());
        full_path.push_str(&prefix);
        full_path.push_str(name);
        entries.push(RemoteDirectoryEntry {
            name: name.to_string(),
            path: full_path,
        });
    }

    entries.sort_unstable_by(|a, b| a.name.cmp(&b.name));

    Ok(RemoteDirectoryListing {
        path: resolved_path,
        entries,
    })
}

fn shell_escape(s: &str) -> String {
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

fn decode_output(bytes: Vec<u8>) -> String {
    match String::from_utf8(bytes) {
        Ok(value) => value,
        Err(err) => {
            let bytes = err.into_bytes();
            String::from_utf8_lossy(&bytes).into_owned()
        }
    }
}
