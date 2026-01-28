# Tauri backend (src-tauri/)

## Overview
Rust (edition 2021, MSRV 1.70) backend for a Tauri 2 desktop app. The Tauri command surface is the contract with the frontend (`src/api/*`).

## Entry points
- Binary entry: `src-tauri/src/main.rs` → `codex_desktop_lib::run()`
- App wiring: `src-tauri/src/lib.rs` (`tauri::Builder`, `.manage(...)`, `generate_handler![...]`)
- Config: `src-tauri/tauri.conf.json` (dev/build hooks, window config, bundle externalBin)
- Permissions: `src-tauri/capabilities/default.json`

## Commands & wiring

See `src-tauri/src/AGENTS.md` for the detailed command wiring workflow and module boundaries.

## codex-acp sidecar
- Build pipeline fetches a platform binary via `scripts/fetch-codex-acp.mjs`.
- Runtime selection is implemented in `src-tauri/src/codex/binary.rs`:
  - debug defaults to **npx**
  - release defaults to **sidecar**
  - `CODEX_DESKTOP_ACP_*` env vars can override

## Development
```bash
# from repo root
npm run tauri dev

# from src-tauri/
cargo fmt --all -- --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

## Nested guides
- `src-tauri/src/AGENTS.md` (module boundaries + event/command conventions)
