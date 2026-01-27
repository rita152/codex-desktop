# Git 集成（当前实现）

## 概览
- 后端通过系统 `git` CLI 执行命令，复用本机 Git 配置/SSH/GPG。
- 现阶段 Git 操作由 AI 执行，用户侧只需要查看完整提交历史。
- 远程目录采用“方案 1”：通过 SSH 在远端执行 `git log --all`，只读展示历史。

## 前置条件（本地历史）
- 系统 PATH 中可用 `git`。
- 目录为仓库根或子目录均可，`git` 会自动解析仓库根。

## 前置条件（远程历史，方案 1）
- 本机可用 `ssh`，且 `~/.ssh/config` 中有对应 Host 条目。
- 远端 PATH 中可用 `git`。
- 仅支持只读历史，不包含 diff/checkout/reset 等写操作。

## UI 使用（历史查看）
1. 打开右侧侧边栏 → Git 图标。
2. 若当前目录不是 Git 仓库，会提示“未检测到 Git 仓库”。
3. 若是仓库，会展示提交历史（默认包含全部分支）。

说明：
- 本地目录：右键提交仍提供 Checkout / Reset（hard），但不是主要使用流程。
- 远程目录：显示只读历史（方案 1），默认不提供右键操作。

## 工作目录与刷新
- 使用当前会话的工作目录（顶部路径选择器）。
- 面板可见且为仓库时，会自动拉取一次提交历史（`--all`）。
- 状态会在启用时加载，并每 8 秒刷新一次（用于 ahead/behind 等状态）。
- 分支与远程列表会在检测到仓库后拉取，但当前 UI 不展示。

## 已接入功能（当前主用）
- 提交历史列表（`git_history --all`）
- 提交 refs 标签展示

## 远程历史（方案 1）
- 只读历史接口 `remote_git_history` 通过 SSH 在远端执行 `git log --all` 并解析为 `GitCommit[]`。
- Git 面板在 `remote://` 目录下进入“远程只读”模式，仅展示历史。
- 若远端目录不是 Git 仓库，显示空态提示。

## 实现位置
- 后端：`src-tauri/src/git/`
- 远程历史：`src-tauri/src/remote/commands.rs`
- 前端 API：`src/api/git.ts`
- 状态 Hook：`src/hooks/useGitRepository.ts`
- UI：`src/components/business/GitPanel/`

## 注意事项
- 依赖系统 `git` 在 PATH 中可用。
- Reset（hard）会丢弃未提交改动，请谨慎操作。
- 变更/提交/分支/同步等操作建议由 AI 完成，UI 仅作为历史查看入口。
- 远程历史依赖 SSH 与远端 `git` 可用，默认只读。
