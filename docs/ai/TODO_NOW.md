# 当前任务追踪

**更新日期**: 2026-02-01

---

## 当前任务：Prompt Enhance 功能

**计划文档**: [PROMPT_ENHANCE_PLAN.md](./PROMPT_ENHANCE_PLAN.md)  
**状态**: ✅ 核心功能已完成

### 实施进度

| Step | 任务 | 状态 | 文件 |
|------|------|------|------|
| 1 | 前端 API 层扩展 | ✅ 已完成 | `src/api/codex.ts` |
| 2 | usePromptEnhance Hook | ✅ 已完成 | `src/hooks/usePromptEnhance.ts` |
| 3 | UI 集成 | ✅ 已完成 | `src/components/business/ChatInput/index.tsx` |
| 4 | 类型定义 | ✅ 无需新增 | - |
| 5 | System Prompt | 📋 待后续 | hook 内置默认 prompt |

### 完成的改动

**Step 1 - API 层**:
- `src/api/codex.ts`: 新增 `killSession()`，修改 `createSession()` 支持 `ephemeral` 参数

**Step 2 - Hook**:
- `src/hooks/usePromptEnhance.ts`: 新建，提供 `enhance()`, `isEnhancing`, `error`, `cancel()`

**Step 3 - UI**:
- `src/components/ui/data-display/Icon/index.tsx`: 新增 `SparklesIcon`, `LoaderIcon`
- `src/components/business/ChatInput/index.tsx`: 集成 hook，添加优化按钮
- `src/components/business/ChatInput/ChatInput.css`: 按钮样式和 loading 动画
- `src/i18n/locales/*.json`: 添加翻译

### 关键决策

- ✅ 使用 Ephemeral Session 方案
- ✅ 不传递当前会话上下文
- ✅ UI 放在 ChatInput 工具栏
- ✅ 优化完成后直接替换输入框内容
- ✅ 优化失败直接提示错误
- ✅ 内置默认 System Prompt（可后续配置化）

---

## 验证

- [ ] 手动测试：输入 prompt，点击优化按钮
- [ ] 验证 session 被正确创建和销毁
- [ ] 验证主会话功能不受影响

## 后续可选

- 将 System Prompt 移至可配置常量
- 添加用户自定义 System Prompt 功能
- 优化错误提示 UI（使用 toast/notice）
