# Frontend API layer (src/api/)

## Overview

Thin, typed wrappers around Tauri `invoke()` commands. This is the UI ↔ backend boundary.

## Rules

- Prefer **one file per domain** (e.g. `codex.ts`, `git.ts`, `terminal.ts`).
- Keep wrappers thin: map params, call `invoke`, return typed result.
- Do not import from `src/components/**` (avoid api → components dependency).
- If the Rust side expects snake_case, keep backward compatibility when needed by sending **both** (e.g. `sessionId` + `session_id`).

## Adding a new command

Rust-side wiring details live in `src-tauri/src/AGENTS.md`. This directory only owns the typed `invoke('<command_name>', payload)` wrapper.

## Files

- `codex.ts`: Codex session lifecycle + prompt/approve/config.
- `git.ts`: Git status/history/checkout/reset + remote git history.
- `terminal.ts`: PTY lifecycle and IO.
- `filesystem.ts`: local directory listing.
