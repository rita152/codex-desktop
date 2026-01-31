# Remote domain (src-tauri/src/remote/)

## Overview
SSH-based remote support: list servers, test connectivity, browse directories, and run Codex ACP remotely.

## Current implementation constraints
- Server list is read from `~/.ssh/config`.
- `remote_add_server` / `remote_remove_server` intentionally do not persist; they return a guidance error.
- `RemoteServerManager` currently ignores the `remote-servers.json` path passed at construction (reserved for future work).

## Key files
- `commands.rs`: tauri commands (`remote_list_servers`, `remote_test_connection`, `remote_list_directory`, ...)
- `ssh_process.rs`: spawns remote `npx codex-acp`, syncs `~/.codex/{auth.json,config.toml}`
- `types.rs`: serializable DTOs

## Rules
- Treat all remote output as untrusted input; keep parsing strict and errors explicit.
