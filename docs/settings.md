# 设置面板（当前实现）

## 入口与布局
- 从主界面“设置”入口打开，快捷键配置见下文。
- 模态覆盖式 UI；左侧导航可搜索并支持拖拽调整宽度，右侧展示具体设置项。
- 保存状态提示：保存中 / 已保存 / 保存失败。

## 数据存储
- 前端会尝试调用 `get_settings` / `save_settings`（当前后端未实现，自动回退至 localStorage）。
- localStorage key：`codex-desktop-settings`。
- 默认值定义：`src/types/settings.ts`。
- 设置为“自动保存”，每次修改都会立即落盘并显示保存状态。

## 生效机制
- 主题切换会写入 `document.documentElement[data-theme]`，并在跟随系统时监听系统主题变化。
- 语言切换会直接触发 `i18n.changeLanguage` 即刻生效。

## 已开放的设置分区

### 通用
- 语言：简体中文 / English（切换后立即生效）。
- 主题：浅色 / 深色 / 跟随系统（跟随系统会监听主题变化）。

### 模型
- 配置文件编辑：`~/.codex/config.toml` 与 `~/.codex/auth.json`（Monaco 编辑器，支持保存）。
- 默认模型选择：从会话动态获取，可手动点击“获取模型”刷新。
- Web 预览环境不可读取本地配置文件，会显示占位内容。
- 保存按钮会直接写入本机 `~/.codex/` 文件（需要 Tauri 运行环境）。

### 远程服务器
- 提示配置来源于 `~/.ssh/config`。
- 内嵌 RemoteServerManager：服务器列表 + 测试连接。
- Web 预览中无 Tauri Runtime 时不会展示服务器列表。

### 快捷键
- 点击按钮进入录制模式，按下新的组合键保存。
- 默认值：
  - 新建会话：`CmdOrCtrl+N`
  - 发送消息：`Enter`
  - 停止生成：`Escape`
  - 打开设置：`CmdOrCtrl+,`
  - 切换侧边栏：`CmdOrCtrl+B`
  - 切换终端：``CmdOrCtrl+` ``
- 当前仅保存配置，尚未绑定到全局快捷键系统。

## 兼容性说明
- Web 预览环境下：文件读写、远程服务器列表等 Tauri 能力不可用。
