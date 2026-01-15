# 技术栈

## 前端

- React 19 + TypeScript
- Vite 7（打包和开发服务器）
- CSS 模块（纯 CSS 文件）

## 后端

- Rust（2021 版本）
- Tauri 2 框架
- serde/serde_json 序列化

## Tauri 插件

- `tauri-plugin-opener` - URL/文件打开功能

## 主要依赖

| 包名              | 用途                |
| ----------------- | ------------------- |
| `@tauri-apps/api` | 前端 Tauri API 绑定 |
| `@tauri-apps/cli` | Tauri CLI 工具      |

## 常用命令

```bash
# 开发模式（同时启动 Vite 和 Tauri）
npm run tauri dev

# 构建生产版本
npm run tauri build

# 仅前端开发服务器
npm run dev

# TypeScript 编译检查
npm run build

# 预览生产版本前端
npm run preview
```

## TypeScript 配置

- 目标：ES2020
- 严格模式启用
- 禁止未使用的变量/参数
- JSX：react-jsx 转换
