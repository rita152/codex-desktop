# Frontend hooks (src/hooks/)

## Overview

Hooks own client-side state machines (loading/error/caching) and subscriptions (Tauri events). Prefer moving side-effects here instead of components.

## Patterns

- Prefer hooks that expose `{ data, loading, error, refresh }`-style surfaces.
- For Tauri events:
  - Codex: use `useCodexEvents.ts` as the single subscription point.
  - Be aware `useCodexEvents.ts` uses a `globalThis` guard to avoid duplicate listeners.

## Rules

- Keep business logic (parsing, grouping) in `src/utils/*` and call it from hooks.
- Avoid direct DOM mutation except for documented cases (e.g. theme init in `useSettings.ts`).
- If you must call `invoke()` directly (some hooks do), document why and consider adding a `src/api/*` wrapper instead.

## Testing

Many hook tests use `// @vitest-environment happy-dom`.
