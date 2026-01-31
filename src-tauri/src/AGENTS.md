# Rust backend core (src-tauri/src/)

## Overview
Domain modules + Tauri command wiring live here. Keep `lib.rs` mostly as wiring; push logic into domain modules.

## Module map
- `lib.rs`: tracing init + plugins + managed state + `generate_handler![...]`
- `codex/`: ACP integration, protocol, processes, events (`codex:*`)
- `remote/`: SSH integration and remote listing/history
- `git/`: git CLI integration
- `terminal.rs`: PTY manager + `terminal-output`/`terminal-exit` events
- `codex_dev/`: development-only helpers

## Adding a command
1) Put the implementation in the correct module (prefer `<domain>/commands.rs`).
2) Keep command handlers thin: validate/route to service, return `Result<_, String>`.
3) Register the command in `lib.rs` `generate_handler![...]`.
4) If a new shared state is required, register it via `.manage(...)`.

## Events
- Codex events are defined in `codex/events.rs`.
- Terminal events are emitted from `terminal.rs`.
- If you add a new event, update the frontend listener(s) (usually `src/hooks/useCodexEvents.ts`).

## Gotchas
- Remote servers are sourced from `~/.ssh/config` (current implementation); add/remove is intentionally not persistent. Details live in `remote/AGENTS.md`.
