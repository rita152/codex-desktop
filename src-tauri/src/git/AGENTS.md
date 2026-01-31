# Git domain (src-tauri/src/git/)

## Overview
Git integration via invoking the system `git` CLI.

## Key files
- `commands.rs`: tauri commands (`git_status`, `git_history`, `git_checkout`, `git_reset`)
- `types.rs`: DTOs returned to the frontend
- `mod.rs`: shared helpers for running git and validating cwd

## Rules
- Keep commands deterministic and return serializable DTOs only.
- Prefer minimal, safe git operations; avoid destructive behavior unless explicitly requested by the UI.
