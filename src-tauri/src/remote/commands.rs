//! Tauri commands for remote server management.

use super::types::*;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, BufWriter, Write};
use std::sync::RwLock;
use tauri::State;

/// Remote server manager
pub struct RemoteServerManager {
    servers: RwLock<HashMap<String, RemoteServerConfig>>,
    config_path: std::path::PathBuf,
}

impl RemoteServerManager {
    pub fn new(config_path: std::path::PathBuf) -> Self {
        let manager = Self {
            servers: RwLock::new(HashMap::new()),
            config_path,
        };
        let _ = manager.load();
        manager
    }

    pub fn add(&self, config: RemoteServerConfig) -> anyhow::Result<()> {
        let mut servers = self.servers.write().unwrap();
        servers.insert(config.id.clone(), config);
        drop(servers);
        self.save()
    }

    pub fn remove(&self, id: &str) -> anyhow::Result<()> {
        let mut servers = self.servers.write().unwrap();
        servers.remove(id);
        drop(servers);
        self.save()
    }

    pub fn list(&self) -> Vec<RemoteServerConfig> {
        let servers = self.servers.read().unwrap();
        servers.values().cloned().collect()
    }

    pub fn get(&self, id: &str) -> Option<RemoteServerConfig> {
        let servers = self.servers.read().unwrap();
        servers.get(id).cloned()
    }

    fn load(&self) -> anyhow::Result<()> {
        if !self.config_path.exists() {
            return Ok(());
        }
        let file = File::open(&self.config_path)?;
        let reader = BufReader::new(file);
        let list: Vec<RemoteServerConfig> = serde_json::from_reader(reader)?;
        let mut servers = self.servers.write().unwrap();
        servers.clear();
        servers.reserve(list.len());
        for config in list {
            servers.insert(config.id.clone(), config);
        }
        Ok(())
    }

    fn save(&self) -> anyhow::Result<()> {
        let list: Vec<_> = {
            let servers = self.servers.read().unwrap();
            servers.values().cloned().collect()
        };
        if let Some(parent) = self.config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let file = File::create(&self.config_path)?;
        let mut writer = BufWriter::new(file);
        serde_json::to_writer_pretty(&mut writer, &list)?;
        writer.flush()?;
        Ok(())
    }
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
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).into_owned())
    }
}
