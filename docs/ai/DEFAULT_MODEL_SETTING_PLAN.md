# 默认模型设置功能实现计划

**创建日期**: 2026-01-31  
**状态**: 待实现

---

## 1. 背景与目标

### 1.1 当前问题

- 默认模型是硬编码值 `DEFAULT_MODEL_ID = 'gpt-5.2-high'`
- 首次启动应用无引导流程，用户可能不知道如何配置
- 新建会话总是使用硬编码默认值，无法自定义

### 1.2 目标功能

1. **首次启动引导**: 首次进入应用时，自动打开设置界面
2. **默认模型设置**: 设置界面可选择默认模型，持久化保存
3. **新会话使用默认模型**: 创建新会话时使用用户设置的默认模型
4. **对话中可切换模型**: 保持当前功能不变
5. **新开对话切回默认**: 新会话始终使用设置中的默认模型

---

## 2. 技术方案

### 2.1 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│  settingsStore (localStorage 持久化)                                │
│     + defaultModelId: string | null                                 │
│     + hasCompletedInitialSetup: boolean                             │
├─────────────────────────────────────────────────────────────────────┤
│  sessionStore.createNewChat()                                       │
│     改为: model = settingsStore.defaultModelId ?? DEFAULT_MODEL_ID  │
├─────────────────────────────────────────────────────────────────────┤
│  SettingsModal                                                      │
│     + 默认模型选择器 (复用现有 ModelSelector 组件)                    │
│     + 首次设置完成后标记 hasCompletedInitialSetup = true            │
├─────────────────────────────────────────────────────────────────────┤
│  App.tsx                                                            │
│     + 首次启动检测 → 自动打开设置界面                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 用户流程

```
首次启动
    │
    ├──▶ hasCompletedInitialSetup = false
    │       │
    │       └──▶ 自动打开设置界面
    │               │
    │               ├──▶ 等待 warmup 获取可用模型列表
    │               │
    │               ├──▶ 用户选择默认模型
    │               │
    │               └──▶ 点击"完成/保存" → markSetupComplete()
    │
后续启动
    │
    ├──▶ hasCompletedInitialSetup = true
    │       │
    │       └──▶ 正常进入，新会话使用 defaultModelId
    │
对话中
    │
    ├──▶ 用户可随时切换模型（仅影响当前会话）
    │
新建会话
    │
    └──▶ 自动使用 defaultModelId
```

---

## 3. 实现阶段

### Phase 1: 扩展 settingsStore

**目标**: 添加默认模型相关状态和持久化

**文件**: `src/stores/settingsStore.ts`

**改动内容**:

```typescript
// 新增状态
interface SettingsState {
  // 现有字段...
  
  defaultModelId: string | null;        // 用户设置的默认模型
  hasCompletedInitialSetup: boolean;    // 是否完成首次设置
}

// 新增 actions
interface SettingsActions {
  // 现有 actions...
  
  setDefaultModelId: (modelId: string | null) => void;
  markSetupComplete: () => void;
}
```

**持久化**: 使用 zustand persist 中间件，存储到 localStorage

---

### Phase 2: 修改 createNewChat 使用默认模型

**目标**: 新建会话时读取设置中的默认模型

**文件**: `src/stores/sessionStore.ts`

**改动内容**:

```typescript
createNewChat: (cwd, title) => {
  // 从 settingsStore 获取默认模型
  const { defaultModelId } = useSettingsStore.getState();
  const model = defaultModelId ?? DEFAULT_MODEL_ID;
  
  const newSession: ChatSession = {
    id: String(Date.now()),
    title,
    cwd,
    model,  // 使用设置中的默认模型
    mode: DEFAULT_MODE_ID,
  };
  // ... 其余逻辑不变
}
```

**依赖**: Phase 1 完成

---

### Phase 3: 设置界面添加默认模型选择器

**目标**: 用户可在设置界面选择默认模型

**文件**: `src/components/business/SettingsModal.tsx`

**改动内容**:

1. 添加"默认模型"选择器 UI
2. 绑定 `defaultModelId` 状态
3. 选择后调用 `setDefaultModelId()`
4. 首次设置完成后调用 `markSetupComplete()`

**UI 设计**:

```
┌─────────────────────────────────────────┐
│  设置                              [X]  │
├─────────────────────────────────────────┤
│                                         │
│  默认模型                               │
│  ┌─────────────────────────────────┐   │
│  │ GPT-5.2 High                  ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
│  (其他现有设置项...)                     │
│                                         │
├─────────────────────────────────────────┤
│                          [保存]         │
└─────────────────────────────────────────┘
```

**依赖**: Phase 1 完成，需要可用模型列表 (来自 warmup 或 modelCache)

---

### Phase 4: 首次启动检测

**目标**: 首次启动时自动打开设置界面

**文件**: `src/App.tsx`

**改动内容**:

```typescript
// 在 AppContent 组件中添加
useEffect(() => {
  const { hasCompletedInitialSetup } = useSettingsStore.getState();
  if (!hasCompletedInitialSetup) {
    // 延迟打开，等待 warmup 获取模型列表
    const timer = setTimeout(() => {
      openSettings();
    }, 1000); // 给 warmup 足够时间
    return () => clearTimeout(timer);
  }
}, [openSettings]);
```

**依赖**: Phase 1, Phase 3 完成

---

## 4. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/stores/settingsStore.ts` | 修改 | 添加 defaultModelId, hasCompletedInitialSetup |
| `src/stores/sessionStore.ts` | 修改 | createNewChat 使用默认模型 |
| `src/components/business/SettingsModal.tsx` | 修改 | 添加默认模型选择器 |
| `src/App.tsx` | 修改 | 添加首次启动检测 |

---

## 5. 测试计划

### 5.1 首次启动流程

- [ ] 清除 localStorage 后启动应用
- [ ] 验证自动打开设置界面
- [ ] 验证模型列表正确加载
- [ ] 选择默认模型并保存
- [ ] 验证 hasCompletedInitialSetup 标记为 true

### 5.2 新会话使用默认模型

- [ ] 设置默认模型为 A
- [ ] 新建会话，验证模型为 A
- [ ] 切换模型为 B
- [ ] 再新建会话，验证模型仍为 A

### 5.3 对话中切换模型

- [ ] 在对话中切换模型
- [ ] 发送消息，验证使用新模型
- [ ] 不影响其他会话

### 5.4 持久化验证

- [ ] 设置默认模型后刷新页面
- [ ] 验证设置保持
- [ ] 验证不再显示首次引导

---

## 6. 风险与注意事项

1. **模型列表加载时机**: 首次启动时设置界面需要等待 warmup 完成才能显示模型列表，需要处理加载状态

2. **默认值兼容性**: 如果用户设置的默认模型在后续版本中被移除，需要有回退机制

3. **首次启动判断**: `hasCompletedInitialSetup` 只在用户明确完成设置后标记，避免用户关闭设置界面后被反复打扰

---

## 7. 未来扩展

- 支持设置默认 Mode (agent-full / agent-lite 等)
- 支持按项目目录设置不同的默认模型
- 首次启动引导可扩展为多步骤向导 (API Key 配置等)
