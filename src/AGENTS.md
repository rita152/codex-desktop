# Frontend (src/)

## Overview

React 19 + TypeScript (strict) + Vite 7 UI. This layer should stay mostly platform-agnostic; the only desktop boundary is via `src/api/*` and a small set of event hooks.

## Module boundaries (preferred)

- **pages / orchestration**: `src/App.tsx` (state + composition; keep it as wiring, push logic down).
- **hooks**: `src/hooks/*` (state machines, caching, subscriptions, orchestration helpers).
- **api**: `src/api/*` (thin `invoke()` wrappers; typed request/response boundary).
- **components**: `src/components/ui/*` (pure UI) and `src/components/business/*` (compose UI + hooks).
- **utils**: `src/utils/*` (pure helpers; parsing, grouping, remote path handling).
- **types**: `src/types/*` (shared/DTO-ish types; avoid pulling types from component folders into api).

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

- No hard-coded colors: use CSS variables from `src/styles/variables.css` (see `.kiro/steering/frontend-rules.md`).

## Testing

- Unit tests: `npm run test:unit` (Vitest; tests live next to code, e.g. `src/hooks/*.test.tsx`).
- Browser tests: `npm run test` (Vitest browser + Playwright).

## Where to look

- Events: `src/hooks/useCodexEvents.ts` and `src/hooks/codexEventMessageHandlers.ts`
- Protocol parsing/compat: `src/utils/codexParsing.ts`
- remote://: `src/utils/remotePath.ts`
- Git UI data: `src/hooks/useGitRepository.ts` + `src/api/git.ts`
