# Codex CLI 集成计划

## 概述

将 Codex CLI 集成到 Codex Desktop，通过子进程方式运行 `codex-acp`，使用 ACP 协议进行通信。

## 技术方案

- **集成方式**：子进程 + ACP 协议（stdio）
- **认证方式**：优先支持 Codex CLI 原生认证
- **二进制来源**：通过 npm 安装 `@zed-industries/codex-acp`

---

## 阶段一：后端基础设施

### Task 1.1：ACP 协议类型定义

**目标**：定义 ACP 协议的 Rust 类型

**文件**：
- `src-tauri/src/codex/types.rs`

**内容**：
- [ ] 定义 `AcpRequest` 枚举（Initialize, Authenticate, NewSession, Prompt, Cancel）
- [ ] 定义 `AcpResponse` 枚举（对应响应类型）
- [ ] 定义 `SessionUpdate` 事件类型（AgentMessageChunk, ToolCall, ApprovalRequest 等）
- [ ] 定义 `ContentBlock` 类型（Text, Image, ResourceLink）
- [ ] 定义 `ToolKind` 枚举（Read, Edit, Execute, Search, Fetch）
- [ ] 定义 `ApprovalDecision` 枚举（AllowAlways, AllowOnce, RejectOnce）

**验收标准**：
```bash
cd src-tauri && cargo check
# 编译通过，无错误
```

---

### Task 1.2：子进程管理器

**目标**：实现 codex-acp 子进程的启动和管理

**文件**：
- `src-tauri/src/codex/process.rs`

**内容**：
- [ ] `CodexProcess` 结构体，管理子进程生命周期
- [ ] `spawn()` 方法：启动 codex-acp 进程，绑定 stdin/stdout
- [ ] `kill()` 方法：终止进程
- [ ] `is_alive()` 方法：检查进程状态
- [ ] 错误处理：进程启动失败、意外退出

**依赖**：
- 需要系统安装 `npx` 或预装 codex-acp 二进制

**验收标准**：
```rust
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_spawn_and_kill() {
        let process = CodexProcess::spawn().await.unwrap();
        assert!(process.is_alive());
        process.kill().await.unwrap();
        assert!(!process.is_alive());
    }
}
```

---

### Task 1.3：ACP 协议通信层

**目标**：实现与 codex-acp 的 JSON-RPC 通信

**文件**：
- `src-tauri/src/codex/protocol.rs`

**内容**：
- [ ] `AcpConnection` 结构体，封装 stdin/stdout 读写
- [ ] `send_request()` 方法：发送请求并等待响应
- [ ] `read_notification()` 方法：读取事件通知流
- [ ] JSON 序列化/反序列化
- [ ] 请求 ID 管理

**验收标准**：
```rust
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_send_initialize() {
        let mut conn = AcpConnection::new(process).await.unwrap();
        let response = conn.send_request(AcpRequest::Initialize { ... }).await;
        assert!(response.is_ok());
    }
}
```

---

### Task 1.4：Codex 服务封装

**目标**：封装完整的 Codex 会话管理

**文件**：
- `src-tauri/src/codex/service.rs`
- `src-tauri/src/codex/mod.rs`

**内容**：
- [ ] `CodexService` 结构体，管理多个会话
- [ ] `initialize()` 方法：初始化 ACP 连接
- [ ] `authenticate()` 方法：执行认证流程
- [ ] `create_session()` 方法：创建新会话
- [ ] `send_prompt()` 方法：发送用户消息
- [ ] `cancel()` 方法：取消当前操作
- [ ] `approve()` 方法：响应审批请求
- [ ] 事件回调机制

**验收标准**：
```rust
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_full_flow() {
        let service = CodexService::new().await.unwrap();
        service.initialize().await.unwrap();
        service.authenticate(AuthMethod::OpenAiApiKey).await.unwrap();
        let session_id = service.create_session("/tmp/test").await.unwrap();
        // 验证会话创建成功
        assert!(!session_id.is_empty());
    }
}
```

---

### Task 1.5：Tauri 命令注册

**目标**：暴露 Codex 功能给前端

**文件**：
- `src-tauri/src/codex/commands.rs`
- `src-tauri/src/lib.rs`（修改）

**内容**：
- [ ] `#[tauri::command] codex_init()` - 初始化服务
- [ ] `#[tauri::command] codex_auth(method, api_key)` - 认证
- [ ] `#[tauri::command] codex_new_session(cwd)` - 创建会话
- [ ] `#[tauri::command] codex_prompt(session_id, content)` - 发送消息
- [ ] `#[tauri::command] codex_cancel(session_id)` - 取消
- [ ] `#[tauri::command] codex_approve(session_id, request_id, decision)` - 审批
- [ ] 在 `lib.rs` 注册所有命令

**验收标准**：
```bash
cd src-tauri && cargo build
# 编译通过

# 前端可以调用：
invoke('codex_init')
invoke('codex_auth', { method: 'openai-api-key', apiKey: 'sk-...' })
```

---

### Task 1.6：事件推送机制

**目标**：将 Codex 事件实时推送到前端

**文件**：
- `src-tauri/src/codex/events.rs`
- `src-tauri/src/codex/commands.rs`（修改）

**内容**：
- [ ] 定义 Tauri 事件名称常量
- [ ] `codex:message` - AI 消息流
- [ ] `codex:tool-call` - 工具调用
- [ ] `codex:approval-request` - 审批请求
- [ ] `codex:error` - 错误
- [ ] `codex:turn-complete` - 回合完成
- [ ] 实现事件发射逻辑

**验收标准**：
```typescript
// 前端可以监听事件
import { listen } from '@tauri-apps/api/event';

await listen('codex:message', (event) => {
  console.log('收到消息:', event.payload);
});
```

---

## 阶段二：前端基础设施

### Task 2.1：类型定义

**目标**：定义前端 TypeScript 类型

**文件**：
- `src/types/codex.ts`

**内容**：
- [ ] `CodexAuthMethod` 类型
- [ ] `CodexSession` 接口
- [ ] `CodexEvent` 联合类型
- [ ] `MessageChunk` 接口
- [ ] `ToolCall` 接口
- [ ] `ApprovalRequest` 接口
- [ ] `ApprovalDecision` 类型

**验收标准**：
```bash
npm run build
# TypeScript 编译通过
```

---

### Task 2.2：API 封装层

**目标**：封装 Tauri invoke 调用

**文件**：
- `src/api/codex.ts`

**内容**：
- [ ] `initCodex()` - 初始化
- [ ] `authenticate(method, apiKey?)` - 认证
- [ ] `createSession(cwd)` - 创建会话
- [ ] `sendPrompt(sessionId, content)` - 发送消息
- [ ] `cancelPrompt(sessionId)` - 取消
- [ ] `approveRequest(sessionId, requestId, decision)` - 审批
- [ ] `subscribeToEvents(handlers)` - 订阅事件

**验收标准**：
```typescript
// 可以正常调用，类型正确
const sessionId = await createSession('/path/to/project');
// sessionId: string
```

---

### Task 2.3：useCodex Hook

**目标**：封装 Codex 状态管理

**文件**：
- `src/hooks/useCodex.ts`

**内容**：
- [ ] 管理连接状态（disconnected, connecting, connected, authenticated）
- [ ] 管理当前会话 ID
- [ ] 管理消息流缓冲
- [ ] 管理待处理的审批请求
- [ ] `connect()` 方法
- [ ] `authenticate()` 方法
- [ ] `sendMessage()` 方法
- [ ] `approve()` 方法
- [ ] `cancel()` 方法
- [ ] 自动清理事件监听

**验收标准**：
```typescript
const { 
  status, 
  sendMessage, 
  pendingApprovals,
  approve 
} = useCodex(sessionId);

// status 正确反映连接状态
// sendMessage 可以发送消息
```

---

## 阶段三：核心 UI 组件

### Task 3.1：流式消息渲染

**目标**：支持 AI 消息的流式显示

**文件**：
- `src/components/business/ChatMessageList/types.ts`（修改）
- `src/components/business/ChatMessageList/index.tsx`（修改）

**内容**：
- [ ] `Message` 类型添加 `isStreaming` 字段
- [ ] `Message` 类型添加 `toolCalls` 字段
- [ ] 流式消息显示光标动画
- [ ] 消息内容增量更新

**验收标准**：
- 消息可以逐字显示
- 流式消息有闪烁光标
- 完成后光标消失

---

### Task 3.2：工具调用卡片

**目标**：展示 AI 的工具调用

**文件**：
- `src/components/ui/ToolCallCard/index.tsx`
- `src/components/ui/ToolCallCard/ToolCallCard.css`
- `src/components/ui/ToolCallCard/types.ts`
- `src/components/ui/ToolCallCard/ToolCallCard.stories.tsx`

**内容**：
- [ ] 根据 `ToolKind` 显示不同图标（读取、编辑、执行、搜索）
- [ ] 显示工具调用标题和状态（进行中、完成、失败）
- [ ] 可折叠的输出内容
- [ ] 执行命令显示终端样式输出

**验收标准**：
```bash
npm run storybook
# 在 Storybook 中可以看到不同状态的 ToolCallCard
```

---

### Task 3.3：审批对话框

**目标**：实现命令执行和补丁应用的审批 UI

**文件**：
- `src/components/ui/ApprovalDialog/index.tsx`
- `src/components/ui/ApprovalDialog/ApprovalDialog.css`
- `src/components/ui/ApprovalDialog/types.ts`
- `src/components/ui/ApprovalDialog/ApprovalDialog.stories.tsx`

**内容**：
- [ ] 显示待审批的命令或补丁内容
- [ ] 三个按钮：始终允许、允许一次、拒绝
- [ ] 拒绝时可输入反馈
- [ ] 命令审批显示命令内容
- [ ] 补丁审批显示 Diff 预览

**验收标准**：
```bash
npm run storybook
# 在 Storybook 中可以交互测试审批流程
```

---

### Task 3.4：Diff 预览组件

**目标**：展示代码变更的 Diff 视图

**文件**：
- `src/components/ui/DiffViewer/index.tsx`
- `src/components/ui/DiffViewer/DiffViewer.css`
- `src/components/ui/DiffViewer/types.ts`
- `src/components/ui/DiffViewer/DiffViewer.stories.tsx`

**内容**：
- [ ] 支持 unified diff 格式解析
- [ ] 添加行高亮（绿色添加、红色删除）
- [ ] 显示文件路径
- [ ] 行号显示

**验收标准**：
```bash
npm run storybook
# 在 Storybook 中可以看到格式化的 Diff 视图
```

---

## 阶段四：业务集成

### Task 4.1：认证流程

**目标**：实现应用启动时的认证流程

**文件**：
- `src/components/business/AuthDialog/index.tsx`
- `src/components/business/AuthDialog/AuthDialog.css`
- `src/components/business/AuthDialog/types.ts`

**内容**：
- [ ] API Key 输入表单
- [ ] 支持选择认证方式（Codex API Key / OpenAI API Key）
- [ ] 认证状态显示
- [ ] 错误提示
- [ ] 记住 API Key（可选，存储到系统密钥链）

**验收标准**：
- 输入有效 API Key 后可以成功认证
- 无效 API Key 显示错误提示

---

### Task 4.2：App.tsx 集成

**目标**：将 Codex 集成到主应用

**文件**：
- `src/App.tsx`（修改）

**内容**：
- [ ] 应用启动时初始化 Codex
- [ ] 未认证时显示认证对话框
- [ ] 每个会话对应一个 Codex Session
- [ ] 替换模拟 AI 回复为真实 Codex 调用
- [ ] 处理流式消息更新
- [ ] 处理审批请求弹窗

**验收标准**：
- 可以发送消息并收到 AI 回复
- 工具调用正确显示
- 审批请求可以正常处理

---

### Task 4.3：会话状态持久化

**目标**：保存和恢复会话状态

**文件**：
- `src/hooks/useSessionPersistence.ts`
- `src/api/storage.ts`

**内容**：
- [ ] 保存会话列表到本地存储
- [ ] 保存每个会话的消息历史
- [ ] 应用启动时恢复会话
- [ ] 会话切换时的状态管理

**验收标准**：
- 关闭应用后重新打开，会话列表保留
- 历史消息可以查看

---

## 阶段五：完善与优化

### Task 5.1：错误处理

**目标**：完善错误处理和用户提示

**内容**：
- [ ] Codex 进程崩溃时的重连机制
- [ ] 网络错误提示
- [ ] API 限流提示
- [ ] 认证过期处理

---

### Task 5.2：斜杠命令支持

**目标**：支持 Codex 内置斜杠命令

**内容**：
- [ ] 输入框支持 `/` 命令提示
- [ ] 支持 `/review`、`/compact`、`/undo` 等命令
- [ ] 命令自动补全

---

### Task 5.3：设置面板

**目标**：添加 Codex 相关设置

**内容**：
- [ ] 模型选择
- [ ] 审批模式选择
- [ ] 推理强度设置
- [ ] API Key 管理

---

## 依赖关系

```
Task 1.1 ──┬──► Task 1.2 ──► Task 1.3 ──► Task 1.4 ──► Task 1.5 ──► Task 1.6
           │
           └──► Task 2.1 ──► Task 2.2 ──► Task 2.3
                                              │
Task 3.1 ──┬──────────────────────────────────┴──► Task 4.2
Task 3.2 ──┤
Task 3.3 ──┤
Task 3.4 ──┘
           │
           └──► Task 4.1 ──► Task 4.2 ──► Task 4.3 ──► Task 5.x
```

---

## 里程碑

| 里程碑 | 包含 Task | 目标 |
|--------|-----------|------|
| M1 | 1.1 - 1.6 | 后端可以与 codex-acp 通信 |
| M2 | 2.1 - 2.3 | 前端可以调用后端 API |
| M3 | 3.1 - 3.4 | UI 组件就绪 |
| M4 | 4.1 - 4.3 | 完整可用的集成 |
| M5 | 5.1 - 5.3 | 生产就绪 |
