# 远程服务器（当前实现）

## 概览
- 通过 SSH 在远端启动 `codex-acp`，本地与远程会话共用同一套 UI/协议。
- 远程工作目录使用 `remote://<server-id>/<path>` 标识。

## 前置条件
- 本机可用 `ssh` / `scp`，并能免交互完成认证。
- 远端需要 Node.js + npx（连接测试会执行 `node --version`）。
- 需要 Tauri 运行环境，Web 预览中不会读取远程服务器列表。

## 服务器来源（~/.ssh/config）
- 仅解析 `Host` 别名（无通配符的 Host 条目）。
- 支持字段：`HostName`、`User`、`Port`、`IdentityFile`（含 Include/通配解析）。
- 认证方式：SSH Agent 或 KeyFile；不支持密码认证。
- 添加/删除服务器：请直接编辑 `~/.ssh/config`，应用内仅展示与测试。
- `server-id` 即 Host 别名，将直接用于 `remote://` 路径。

示例：

```
Host my-remote
  HostName example.com
  User ubuntu
  Port 22
  IdentityFile ~/.ssh/id_rsa
```

## UI 入口
- 侧边栏 Remote 标签页：服务器列表 + 测试连接。
- 设置 → 远程服务器：嵌入同一列表。

## 路径规则
- 远程路径格式：`remote://<server-id>/<absolute-path>`。
- 空路径或 `~` 会被解析为远端 `$HOME`。

## 选择远程工作目录
1. 点击顶部工作目录按钮。
2. 选择 “Remote Server”。
3. 选择服务器 → 浏览目录 → “Select This Directory”。

说明：
- 目录浏览使用 `remote_list_directory`，仅展示子目录。
- 空路径/`~` 会被视为 `$HOME`。
- 目录选择器支持向下钻取；返回按钮会回到服务器列表（不会回到上级目录）。

## 远程文件浏览
- File Browser 支持 `remote://` 路径。
- 目录/文件由 `remote_list_entries` 返回，文件大小当前为占位 0。
- 远程目录优先展示，文件在后。
- 可通过列表顶部的 `...` 返回上级目录。

## 远程 Git 历史（方案 1）
- 在远端通过 SSH 执行 `git log --all`，只读返回提交历史。
- Git 面板在远程路径下进入“只读历史”模式，不提供 checkout/reset 等写操作。
- 远端需可用 `git`，且目标路径为仓库根或子目录。

## 连接与启动流程
- SSH 参数：`StrictHostKeyChecking=accept-new`、`BatchMode=yes`、`ConnectTimeout=10`，会话保活 `ServerAliveInterval=15` / `ServerAliveCountMax=3`。
- `remote_test_connection` 会检查 `node --version`，远端需要 Node.js + npx。
- 远端启动命令：
  - `CODEX_HOME=$HOME/.codex NO_BROWSER=1 npx --yes @zed-industries/codex-acp@0.9.0`
  - 可通过 `CODEX_DESKTOP_ACP_NPX_SPEC` 覆盖 npx 包版本。
- 若远端缺少 `~/.codex/auth.json` 或 `config.toml`，会从本地 `CODEX_HOME` 复制（不覆盖已有文件）。
- 若本地 `CODEX_HOME` 缺少上述文件，会中止并提示缺失。

## 已知限制
- Git 面板对远程目录仅提供只读历史。
- 密码认证不支持（浏览/连接均拒绝）。
- 依赖本机 `ssh` / `scp` 命令可用。

## 排障建议
- 服务器列表为空：检查 `~/.ssh/config` 是否有无通配符的 `Host` 条目。
- 测试连接失败：先在终端运行 `ssh <host>` 验证，确认密钥权限与已加入 known_hosts。
- 远端报 “Node.js not found”：在远端安装 Node.js。
- 目录浏览失败：检查远端是否允许执行 `find`/`ls`，以及目标路径权限。
