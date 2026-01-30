# Frontend (src/)

## Overview

React 19 + TypeScript (strict) + Vite 7 UI. This layer should stay mostly platform-agnostic; the only desktop boundary is via `src/api/*` and a small set of event hooks.

## State Management (Zustand)

**状态管理正在从 React Context 迁移到 Zustand Stores。**

### Stores (SSOT)

- `src/stores/uiStore.ts` - UI 状态（侧边栏、面板、设置）
- `src/stores/sessionStore.ts` - 会话状态（消息、草稿、选项）
- `src/stores/codexStore.ts` - Codex 状态（审批、队列、会话映射）

### Effect Hooks

- `src/hooks/useSessionEffects.ts` - Session 副作用
- `src/hooks/useCodexEffects.ts` - Codex 初始化
- `src/hooks/useCodexActions.ts` - Codex 业务操作

### 迁移指南

参见 `src/stores/MIGRATION.md` 了解完整迁移指南。

**新组件应该**：

- 使用 `useXxxStore` selectors 获取状态
- 使用 Effect hooks 处理副作用
- 避免使用 `useXxxContext`（已 deprecated）

## Module boundaries (preferred)

- **pages / orchestration**: `src/App.tsx` (state + composition; keep it as wiring, push logic down).
- **stores**: `src/stores/*` (Zustand stores; SSOT for all app state).
- **hooks**: `src/hooks/*` (state machines, caching, subscriptions, orchestration helpers).
- **api**: `src/api/*` (thin `invoke()` wrappers; typed request/response boundary).
- **components**: `src/components/ui/*` (pure UI) and `src/components/business/*` (compose UI + hooks).
- **utils**: `src/utils/*` (pure helpers; parsing, grouping, remote path handling).
- **types**: `src/types/*` (shared/DTO-ish types; avoid pulling types from component folders into api).
- **contexts**: `src/contexts/*` (DEPRECATED - 使用 stores 代替).

## Tauri interaction rules

- Prefer `src/api/*` for `invoke(...)` and `src/hooks/*` for event subscriptions.
- Avoid new `invoke()` / `@tauri-apps/api/event.listen()` in components.
  - Known exceptions exist (historical):
    - `src/components/business/ChatContainer/DirectorySelector.tsx`
    - `src/components/business/FileBrowserPanel/index.tsx`
    - `src/components/business/TerminalPanel/index.tsx`
  - If you touch these, consider migrating the boundary into `src/api/` + `src/hooks/` instead of adding more call sites.

## Quality gate constraints (CI)

These are enforced by `scripts/quality-gate.mjs` (details live in `scripts/AGENTS.md`).

Key impacts on frontend code:

- ESLint warnings fail (`--max-warnings=0`).
- Path/import depth limits and import-cycle checks apply under `src/`.
- Bundle gzip size limits run against `dist/assets`.

## Styling

- No hard-coded colors: use CSS variables from `src/styles/variables.css`.

## Testing

- Unit tests: `npm run test:unit` (Vitest; tests live next to code, e.g. `src/hooks/*.test.tsx`).
- Browser tests: `npm run test` (Vitest browser + Playwright).

## Where to look

- Events: `src/hooks/useCodexEvents.ts` and `src/hooks/codexEventMessageHandlers.ts`
- Protocol parsing/compat: `src/utils/codexParsing.ts`
- remote://: `src/utils/remotePath.ts`
- Git UI data: `src/hooks/useGitRepository.ts` + `src/api/git.ts`
