# 当前任务清单

**更新日期**: 2026-01-31

---

## 正在进行

### [FEAT-001] Debug & Token Usage 事件实现

**状态**: 🟡 计划制定完成，待实施
**优先级**: P2
**文档**: [IMPL_DEBUG_TOKEN_USAGE.md](./IMPL_DEBUG_TOKEN_USAGE.md)

#### 任务背景

codex-acp 发送的两个事件当前前端未处理：
- `codex:debug` - 调试时序信息
- `codex:token-usage` - Token 用量统计

#### Phase 1: Token Usage（优先）

- [ ] **Step 1.1**: 扩展 sessionStore 添加 tokenUsage 状态
- [ ] **Step 1.2**: 添加 codex:token-usage 事件监听
- [ ] **Step 1.3**: 创建 TokenUsage UI 组件
- [ ] **Step 1.4**: 集成到 ChatContainer

#### Phase 2: Debug Panel

- [ ] **Step 2.1**: 添加 DebugEvent 类型
- [ ] **Step 2.2**: 创建 debugStore
- [ ] **Step 2.3**: 添加 codex:debug 事件监听
- [ ] **Step 2.4**: 扩展 uiStore 添加 showDebugPanel
- [ ] **Step 2.5**: 创建 DebugPanel 组件
- [ ] **Step 2.6**: 添加快捷键切换

---

## 待开始

无

---

## 已完成

无

---

## 阻塞项

无

---

## 决策待定

### [DEC-001] Token Usage 显示位置

**选项**:
- A: ChatContainer 底部状态栏（推荐）
- B: 消息列表顶部固定区域
- C: 侧边栏信息面板

**当前倾向**: A

### [DEC-002] Debug Panel 触发方式

**选项**:
- A: 快捷键 Cmd+Shift+D（推荐）
- B: Settings 面板中的开关
- C: 开发模式自动显示

**当前倾向**: A
