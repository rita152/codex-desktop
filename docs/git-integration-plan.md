# Git 集成分析与实施计划

## 1. 行业调研与最佳实践
通过对类似应用（如 VS Code）和技术栈（Tauri/Rust）的调研，我们确认了以下行业标准：

*   **VS Code 模式**：VS Code **不**内置 Git 核心，而是依赖用户系统中安装的 Git。它通过封装命令行调用来实现集成。这种方式最大的优势是**自动复用用户的 SSH 密钥、GPG 签名和 Git 配置**，极大降低了认证实现的复杂度。
*   **Rust 生态选择**：
    *   `git2-rs` (libgit2)：性能极高，但处理 SSH/HTTPS 认证非常复杂。
    *   `std::process::Command` (CLI)：最通用的做法，开发速度快，兼容性好。

**结论**：调研有力地支持了我们原定的 **方案 A**。

## 2. 系统分析
**当前状态**：`codex-desktop` 应用程序基于 **Tauri v2**（React 前端 + Rust 后端）构建。

**可行性**：**高**。Rust 后端提供了一种安全且高性能的方式与系统或文件系统交互。

## 3. 集成策略

### 方案 A：Rust 封装系统 Git 命令（推荐）
此方法涉及 Rust 后端作为一个子进程调用 `user` 环境变量下的 `git` 可执行文件。
*   **优点**：零配置复用用户认证（SSH/HTTPS）；维护成本低；与终端 Git 行为完全一致。
*   **缺点**：用户必须安装 Git。
*   **实现方式**：在 Rust 中使用 `std::process::Command`。

## 4. 实施计划

### 第一阶段：后端基础设施 (Rust)

1.  **创建 Git 模块**：
    - 创建 `src-tauri/src/git/mod.rs`。
    - 创建 `src-tauri/src/git/commands.rs`。

2.  **核心功能**：
    实现 `run_git_command` 辅助函数。
    ```rust
    pub fn run_git(cwd: &Path, args: &[&str]) -> Result<String, String>;
    ```

3.  **暴露 Tauri 命令**：
    - **基础状态**：
        - `git_status`: 解析 `git status --porcelain -z` 获取结构化数据。
        - `git_diff`: 获取变更内容。
    - **写操作**：
        - `git_stage` / `git_unstage`: 暂存/取消暂存文件。
        - `git_commit`: 提交更改。
        - `git_discard`: 放弃更改（还原文件）。
    - **历史与图谱**：
        - `git_history`: 获取提交历史，包含 Graph 所需的元数据。
    - **分支与远程 (完善)**：
        - `git_branch_list`: 获取本地/远程分支列表。
        - `git_checkout`: 切换分支/创建新分支。
        - `git_push` / `git_pull` / `git_fetch`: 同步远程仓库。

4.  **注册命令**：
    - 更新 `lib.rs`。

### 第二阶段：前端 Hook 与状态

1.  **Git Context**：
    - 状态：`isGitRepo`, `currentBranch`, `history`, `remotes`。
    - 增加 `syncStatus` (ahead/behind counts)。

2.  **交互逻辑**：
    - 自动刷新机制。

### 第三阶段：UI 集成

1.  **侧边栏组件**：
    - **历史视图**：提交历史列表与分支/标签引用。
    - **同步与分支**：Refresh / Sync / Switch Branch / Create Branch。
    - **变更模块说明**：Commit/Stage/Diff UI 由 Codex 处理，不在产品内暴露。

2.  **Git Graph 视图**：
    - 独立视图区域。
    - 可视化提交历史与分支轨道。
    - 右键菜单：Checkout commit, Reset to here 等。

## 5. 执行结果
- 已完成 Rust Git 模块与命令注册（`git_status`, `git_diff`, `git_stage`, `git_unstage`, `git_commit`, `git_discard`, `git_history`, `git_branch_list`, `git_checkout`, `git_push`, `git_pull`, `git_fetch` 等）。  
- 已补齐前端 Git 状态管理与自动刷新逻辑，包含 `syncStatus`/remotes/history。  
- 已接入 Git 面板：History 列表、Sync、分支操作、Checkout/Reset 上下文菜单。  
- 已将提交历史改为 `--all` 模式，展示完整分支历史。  
- 已移除 Changes/Commit/Diff UI，提交由 Codex 负责。  
