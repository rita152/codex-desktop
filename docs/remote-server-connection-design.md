# Codex Desktop 远程服务器连接功能设计方案

## 1. 概述

本文档描述了为 Codex Desktop 添加远程服务器文件编辑功能的设计方案。采用与 Zed 编辑器类似的架构：**在远程服务器上运行 codex-acp，本地通过 SSH 隧道与其通信**。

### 1.1 目标

- 通过 SSH 连接远程 Linux 服务器
- 在远程服务器上运行 codex-acp
- 实现与本地相同的完整 AI 编码体验
- 支持远程文件编辑、命令执行、apply_patch 等全部功能

### 1.2 核心思路

```
现有本地模式：
  Codex Desktop ──► 本地 codex-acp ──► 本地文件系统

远程模式：
  Codex Desktop ──SSH隧道──► 远程 codex-acp ──► 远程文件系统
```

**关键洞察**：codex-acp 使用 stdio 进行 JSON-RPC 通信，天然适合 SSH 隧道转发。只需将本地进程的 stdin/stdout 替换为 SSH 隧道的 stdin/stdout。

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Codex Desktop (本地)                             │
│                                                                          │
│  ┌─────────────┐    ┌─────────────────────────────────────────────────┐  │
│  │   Frontend  │◄──►│                Tauri Backend                    │  │
│  │   (React)   │    │                                                 │  │
│  └─────────────┘    │  ┌─────────────────────────────────────────┐   │  │
│                     │  │          CodexService (现有)             │   │  │
│                     │  │                                         │   │  │
│                     │  │  ┌─────────────┐   ┌─────────────────┐  │   │  │
│                     │  │  │ LocalProcess│   │ RemoteSshProcess│  │   │  │
│                     │  │  │  (本地模式)  │   │   (远程模式)     │  │   │  │
│                     │  │  └──────┬──────┘   └────────┬────────┘  │   │  │
│                     │  │         │                   │           │   │  │
│                     │  │         ▼                   ▼           │   │  │
│                     │  │  ┌─────────────────────────────────┐   │   │  │
│                     │  │  │    ACP Protocol (stdin/stdout)  │   │   │  │
│                     │  │  └─────────────────────────────────┘   │   │  │
│                     │  └─────────────────────────────────────────┘   │  │
│                     └────────────────────────┬────────────────────────┘  │
└──────────────────────────────────────────────│───────────────────────────┘
                                               │
                         ┌─────────────────────┴─────────────────────┐
                         │              SSH 隧道                      │
                         │         (JSON-RPC over stdio)              │
                         └─────────────────────┬─────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           远程 Linux 服务器                              │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        codex-acp (远程实例)                        │  │
│  │                                                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │  │
│  │  │  文件读写    │  │  命令执行   │  │ apply_patch │  │   终端   │ │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────┬─────┘ │  │
│  │         │                │                │              │       │  │
│  │         ▼                ▼                ▼              ▼       │  │
│  │  ┌─────────────────────────────────────────────────────────────┐ │  │
│  │  │                    远程本地文件系统                          │ │  │
│  │  │                  /home/user/project/...                     │ │  │
│  │  └─────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  要求：安装 Node.js (用于 npx @zed-industries/codex-acp)                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 与本地模式的代码复用

```rust
// 关键：只需替换进程创建方式，后续代码完全相同！

// 本地模式（现有代码）
let process = CodexProcess::spawn(Some(&app), cfg).await?;
let (stdin, stdout) = process.take_stdio()?;

// 远程模式（新增代码）
let process = RemoteSshProcess::spawn(&ssh_config).await?;
let (stdin, stdout) = process.take_stdio()?;

// 后续完全相同！
let (conn, io_task) = ClientSideConnection::new(
    Arc::new(client),
    stdin.compat_write(),
    stdout.compat(),
    |fut| { tokio::task::spawn_local(fut); },
);
```

---

## 3. 详细实现

### 3.1 数据结构定义

```rust
// src-tauri/src/remote/types.rs
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 远程服务器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteServerConfig {
    /// 服务器唯一标识
    pub id: String,
    /// 服务器名称（用户自定义显示名）
    pub name: String,
    /// SSH 主机地址
    pub host: String,
    /// SSH 端口（默认 22）
    #[serde(default = "default_ssh_port")]
    pub port: u16,
    /// 用户名
    pub username: String,
    /// 认证方式
    pub auth: SshAuth,
}

fn default_ssh_port() -> u16 { 22 }

/// SSH 认证方式
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SshAuth {
    /// SSH 密钥文件认证
    KeyFile {
        private_key_path: PathBuf,
        #[serde(default)]
        passphrase: Option<String>,
    },
    /// SSH Agent 认证（推荐）
    Agent,
    /// 密码认证（不推荐）
    Password { password: String },
}

/// 远程会话配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteSessionConfig {
    /// 服务器 ID
    pub server_id: String,
    /// 远程工作目录
    pub remote_cwd: String,
}
```

### 3.2 SSH 进程管理（核心）

```rust
// src-tauri/src/remote/ssh_process.rs
use anyhow::{anyhow, Context, Result};
use std::process::Stdio;
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

/// 通过 SSH 在远程运行 codex-acp 的进程封装
pub struct RemoteSshProcess {
    child: Child,
    stdin: Option<ChildStdin>,
    stdout: Option<ChildStdout>,
}

impl RemoteSshProcess {
    /// 建立 SSH 连接并在远程启动 codex-acp
    pub async fn spawn(
        config: &RemoteServerConfig,
        remote_cwd: &str,
        api_key: &str,
    ) -> Result<Self> {
        let mut cmd = Command::new("ssh");
        
        // SSH 连接参数
        cmd.arg("-o").arg("StrictHostKeyChecking=accept-new")
           .arg("-o").arg("BatchMode=yes")
           .arg("-o").arg("ServerAliveInterval=15")
           .arg("-o").arg("ServerAliveCountMax=3")
           .arg("-p").arg(config.port.to_string());

        // 认证方式
        match &config.auth {
            SshAuth::KeyFile { private_key_path, .. } => {
                cmd.arg("-i").arg(private_key_path);
            }
            SshAuth::Agent => {
                // 使用系统 SSH Agent，无需额外参数
            }
            SshAuth::Password { .. } => {
                // 密码认证需要使用 sshpass 或其他方式
                // 这里先不支持，推荐使用密钥认证
                return Err(anyhow!("密码认证暂不支持，请使用 SSH 密钥"));
            }
        }

        // 用户@主机
        cmd.arg(format!("{}@{}", config.username, config.host));

        // 远程执行的命令
        let remote_command = Self::build_remote_command(remote_cwd, api_key);
        cmd.arg(remote_command);

        // 配置 stdio
        cmd.stdin(Stdio::piped())
           .stdout(Stdio::piped())
           .stderr(Stdio::inherit()); // stderr 显示在本地终端，用于调试

        tracing::info!(
            "Starting remote codex-acp on {}@{}:{}",
            config.username, config.host, config.port
        );

        let mut child = cmd.spawn()
            .context("无法启动 SSH 进程，请确保 ssh 命令可用")?;

        let stdin = child.stdin.take()
            .ok_or_else(|| anyhow!("无法获取 SSH stdin"))?;
        let stdout = child.stdout.take()
            .ok_or_else(|| anyhow!("无法获取 SSH stdout"))?;

        Ok(Self {
            child,
            stdin: Some(stdin),
            stdout: Some(stdout),
        })
    }

    /// 构建远程执行的命令
    fn build_remote_command(remote_cwd: &str, api_key: &str) -> String {
        // 设置环境变量并启动 codex-acp
        // NO_BROWSER=1 禁用 ChatGPT 浏览器登录（远程不可用）
        format!(
            "cd {} && OPENAI_API_KEY='{}' NO_BROWSER=1 npx @zed-industries/codex-acp 2>/dev/null",
            shell_escape(remote_cwd),
            api_key
        )
    }

    /// 获取 stdin/stdout 用于 ACP 通信
    pub fn take_stdio(&mut self) -> Result<(ChildStdin, ChildStdout)> {
        let stdin = self.stdin.take()
            .ok_or_else(|| anyhow!("stdin 已被获取"))?;
        let stdout = self.stdout.take()
            .ok_or_else(|| anyhow!("stdout 已被获取"))?;
        Ok((stdin, stdout))
    }

    /// 检查进程是否存活
    pub fn is_alive(&mut self) -> bool {
        match self.child.try_wait() {
            Ok(Some(_)) => false,
            Ok(None) => true,
            Err(_) => false,
        }
    }

    /// 终止进程
    pub async fn kill(&mut self) -> Result<()> {
        if self.is_alive() {
            let _ = self.child.kill().await;
        }
        let _ = self.child.wait().await;
        Ok(())
    }
}

/// 简单的 shell 转义
fn shell_escape(s: &str) -> String {
    // 使用单引号包裹，并转义内部的单引号
    format!("'{}'", s.replace('\'', "'\\''"))
}
```

### 3.3 修改 CodexService 支持远程模式

```rust
// src-tauri/src/codex/service.rs (修改部分)

use crate::remote::{RemoteServerConfig, RemoteSshProcess, RemoteSessionConfig};

struct WorkerState {
    app: AppHandle,
    approvals: Arc<ApprovalState>,
    debug: Arc<DebugState>,
    conn: Option<Arc<AcpConnection>>,
    initialized: bool,
    last_init: Option<InitializeResult>,
    api_key_env: Option<(String, String)>,
    // 新增：远程会话配置
    remote_config: Option<RemoteSessionConfig>,
    remote_servers: HashMap<String, RemoteServerConfig>,
}

/// 修改：根据是否为远程会话选择不同的进程启动方式
async fn ensure_connection(state: &mut WorkerState) -> Result<()> {
    if state.conn.is_some() {
        return Ok(());
    }

    let (stdin, stdout) = if let Some(remote) = &state.remote_config {
        // 远程模式
        let server = state.remote_servers.get(&remote.server_id)
            .context("远程服务器配置不存在")?;
        
        let api_key = state.api_key_env.as_ref()
            .map(|(_, v)| v.as_str())
            .unwrap_or("");
        
        let mut process = RemoteSshProcess::spawn(
            server,
            &remote.remote_cwd,
            api_key,
        ).await?;
        
        process.take_stdio()?
    } else {
        // 本地模式（现有逻辑）
        let mut cfg = CodexProcessConfig::default();
        if let Some((key, value)) = state.api_key_env.as_ref() {
            cfg.set_env(key.as_str(), value.as_str());
        }
        
        let mut process = CodexProcess::spawn(Some(&state.app), cfg).await?;
        process.take_stdio()?
    };

    // 后续完全相同！
    let client = AcpClient {
        app: state.app.clone(),
        approvals: state.approvals.clone(),
        debug: state.debug.clone(),
    };

    let (conn, io_task) = ClientSideConnection::new(
        Arc::new(client),
        stdin.compat_write(),
        stdout.compat(),
        |fut| { tokio::task::spawn_local(fut); },
    );

    tokio::task::spawn_local(async move {
        if let Err(err) = io_task.await {
            tracing::error!("ACP I/O error: {}", err);
        }
    });

    state.conn = Some(Arc::new(conn));
    Ok(())
}
```

### 3.4 新增 Tauri Commands

```rust
// src-tauri/src/remote/commands.rs
use super::types::*;
use std::collections::HashMap;
use std::sync::RwLock;
use tauri::State;

/// 远程服务器管理器
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
        let content = std::fs::read_to_string(&self.config_path)?;
        let list: Vec<RemoteServerConfig> = serde_json::from_str(&content)?;
        let mut servers = self.servers.write().unwrap();
        for config in list {
            servers.insert(config.id.clone(), config);
        }
        Ok(())
    }

    fn save(&self) -> anyhow::Result<()> {
        let servers = self.servers.read().unwrap();
        let list: Vec<_> = servers.values().cloned().collect();
        let content = serde_json::to_string_pretty(&list)?;
        if let Some(parent) = self.config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&self.config_path, content)?;
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
pub fn remote_list_servers(
    manager: State<'_, RemoteServerManager>,
) -> Vec<RemoteServerConfig> {
    manager.list()
}

#[tauri::command]
pub async fn remote_test_connection(
    server_id: String,
    manager: State<'_, RemoteServerManager>,
) -> Result<String, String> {
    let config = manager.get(&server_id)
        .ok_or("服务器配置不存在")?;
    
    // 使用 ssh 测试连接
    let output = tokio::process::Command::new("ssh")
        .arg("-o").arg("StrictHostKeyChecking=accept-new")
        .arg("-o").arg("BatchMode=yes")
        .arg("-o").arg("ConnectTimeout=10")
        .arg("-p").arg(config.port.to_string())
        .arg(format!("{}@{}", config.username, config.host))
        .arg("echo 'connection ok' && node --version 2>/dev/null || echo 'Node.js not found'")
        .output()
        .await
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
```

### 3.5 注册模块和命令

```rust
// src-tauri/src/lib.rs (更新)

pub mod codex;
pub mod codex_dev;
pub mod terminal;
pub mod remote; // 新增

use remote::commands::RemoteServerManager;

pub fn run() {
    init_tracing();

    // 远程服务器配置存储路径
    let remote_config_path = dirs::config_dir()
        .unwrap_or_default()
        .join("codex-desktop")
        .join("remote-servers.json");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(codex::commands::CodexManager::default())
        .manage(terminal::TerminalManager::default())
        .manage(RemoteServerManager::new(remote_config_path)) // 新增
        .invoke_handler(tauri::generate_handler![
            greet,
            codex_dev_prompt_once,
            codex::commands::codex_init,
            codex::commands::codex_auth,
            codex::commands::codex_new_session,
            codex::commands::codex_prompt,
            codex::commands::codex_cancel,
            codex::commands::codex_approve,
            codex::commands::codex_set_mode,
            codex::commands::codex_set_model,
            codex::commands::codex_set_config_option,
            terminal::terminal_spawn,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_kill,
            // 新增远程命令
            remote::commands::remote_add_server,
            remote::commands::remote_remove_server,
            remote::commands::remote_list_servers,
            remote::commands::remote_test_connection,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|err| {
            tracing::error!(error = %err, "error running application");
        });
}
```

---

## 4. 前端实现

### 4.1 TypeScript 类型

```typescript
// src/types/remote.ts

export interface RemoteServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth: SshAuth;
}

export type SshAuth =
  | { type: 'key_file'; privateKeyPath: string; passphrase?: string }
  | { type: 'agent' }
  | { type: 'password'; password: string };

export interface RemoteSessionConfig {
  serverId: string;
  remoteCwd: string;
}
```

### 4.2 使用方式

```typescript
// 创建远程会话时
const handleCreateRemoteSession = async (serverId: string, remoteCwd: string) => {
  // 调用修改后的 codex_new_session，传入远程配置
  await invoke('codex_new_session', {
    cwd: `remote://${serverId}${remoteCwd}`,  // 特殊前缀标识远程
  });
};
```

---

## 5. 实施计划

### 5.1 开发阶段

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| **阶段一** | **核心实现** | **2-3 天** |
| | 创建 `remote/` 模块结构 | 0.5 天 |
| | 实现 `RemoteSshProcess` | 1 天 |
| | 修改 `CodexService` 支持远程模式 | 1 天 |
| **阶段二** | **服务器管理** | **1-2 天** |
| | 实现 `RemoteServerManager` | 0.5 天 |
| | 添加 Tauri Commands | 0.5 天 |
| | 配置持久化 | 0.5 天 |
| **阶段三** | **前端 UI** | **2-3 天** |
| | 远程服务器管理界面 | 1 天 |
| | 添加/编辑服务器对话框 | 1 天 |
| | 会话创建流程集成 | 0.5 天 |
| **阶段四** | **测试与优化** | **1-2 天** |
| | 连接测试 | 0.5 天 |
| | 错误处理 | 0.5 天 |
| | 文档更新 | 0.5 天 |

**总预计开发时间：6-10 天**

### 5.2 文件变更清单

```
src-tauri/
├── src/
│   ├── lib.rs                    # 更新：注册远程模块和命令
│   ├── remote/                   # 新增：远程连接模块
│   │   ├── mod.rs
│   │   ├── types.rs              # 数据结构定义
│   │   ├── ssh_process.rs        # SSH 进程管理（核心）
│   │   └── commands.rs           # Tauri 命令
│   └── codex/
│       └── service.rs            # 更新：支持远程进程

src/
├── components/business/
│   └── RemoteServerManager/      # 新增：远程服务器管理 UI
├── hooks/
│   └── useRemoteServer.ts        # 新增
└── types/
    └── remote.ts                 # 新增
```

---

## 6. 远程服务器要求

### 6.1 必需

- **SSH 服务**：标准 sshd，支持密钥认证
- **Node.js**：v18+ (用于运行 `npx @zed-industries/codex-acp`)
- **网络**：能访问 OpenAI API（或配置代理）

### 6.2 推荐

- 使用 SSH 密钥认证（而非密码）
- 配置 SSH Agent 避免重复输入密码
- 使用持久 SSH 连接（ControlMaster）

### 6.3 远程环境检查命令

```bash
# 检查 Node.js
node --version  # 应 >= v18

# 检查 npm
npm --version

# 测试 codex-acp 是否可用
npx @zed-industries/codex-acp --version
```

---

## 7. 安全考虑

### 7.1 认证方式

| 方式 | 安全性 | 推荐度 |
|------|--------|--------|
| SSH Agent | 最高 | ⭐⭐⭐ 强烈推荐 |
| SSH 密钥 | 高 | ⭐⭐ 推荐 |
| 密码 | 低 | ❌ 不推荐 |

### 7.2 API Key 安全

- API Key 只在建立连接时通过 SSH 传输
- 使用环境变量传递，不存储在远程文件系统
- 建议使用环境变量而非硬编码

### 7.3 网络安全

- 所有通信通过 SSH 加密隧道
- 支持代理跳转（ProxyJump）访问内网服务器

---

## 8. 后续优化

1. **连接复用**：使用 SSH ControlMaster 复用连接
2. **自动重连**：断线后自动恢复
3. **离线缓存**：缓存文件结构，减少网络请求
4. **多服务器**：同时连接多个远程服务器
5. **Docker 支持**：通过 SSH 连接到容器内
