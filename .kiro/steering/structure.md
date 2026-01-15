# 项目结构

```
codex-desktop/
├── src/                    # React 前端源码
│   ├── App.tsx            # 主应用组件
│   ├── App.css            # 组件样式
│   ├── main.tsx           # React 入口
│   ├── assets/            # 静态资源（图片、SVG）
│   └── vite-env.d.ts      # Vite 类型声明
│
├── src-tauri/             # Rust/Tauri 后端
│   ├── src/
│   │   ├── lib.rs         # Tauri 命令和应用配置
│   │   └── main.rs        # 应用入口
│   ├── capabilities/      # Tauri 权限定义
│   ├── icons/             # 各平台应用图标
│   ├── Cargo.toml         # Rust 依赖
│   └── tauri.conf.json    # Tauri 配置
│
├── public/                # 静态文件（原样提供）
├── index.html             # HTML 入口
├── vite.config.ts         # Vite 配置
└── tsconfig.json          # TypeScript 配置
```

## 架构模式

前后端通信使用 Tauri 的 invoke 系统：

- 在 `src-tauri/src/lib.rs` 中用 `#[tauri::command]` 定义 Rust 命令
- 在 Tauri builder 的 `invoke_handler` 中注册命令
- 前端使用 `invoke("command_name", { args })` 调用

## 约定

- 前端组件放在 `src/`
- Tauri 命令定义在 `src-tauri/src/lib.rs`
- 新的权限配置添加到 `src-tauri/capabilities/`
- 应用配置在 `src-tauri/tauri.conf.json`
