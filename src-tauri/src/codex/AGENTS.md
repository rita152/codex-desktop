# Codex domain (src-tauri/src/codex/)

## Overview
Runs Codex ACP locally or over SSH, translates protocol updates into Tauri events, and exposes a stable command surface.

## Key files
- `commands.rs`: `#[tauri::command]` entrypoints (init/auth/prompt/session/config)
- `service.rs`: background worker / state machine (thread + tokio runtime)
- `protocol.rs`: protocol adapter → event emission
- `events.rs`: `codex:*` event name constants
- `binary.rs`: selects ACP executable (npx/sidecar + env overrides)
- `process.rs` + `unified_process.rs`: spawn/IO/kill for local + remote processes
- `remote_session.rs`: `remote://...` parsing for cwd routing

## ACP executable selection
Environment overrides (see `binary.rs`):
- `CODEX_DESKTOP_ACP_MODE` = `npx|sidecar`
- `CODEX_DESKTOP_ACP_PATH` (explicit path)
- `CODEX_DESKTOP_ACP_SIDECAR_NAME` (binary name)

## Rules
- Keep protocol compatibility in mind: frontend parsing is defensive (`src/utils/codexParsing.ts`).
- Event names should be centralized (use `events.rs`).
