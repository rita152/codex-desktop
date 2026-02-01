# Development Changelog

## 2026-02-01

### Cleanup: Remove codex-acp dependencies

**Summary**:
Completely removed all codex-acp related code and documentation. The project now uses direct codex-core integration instead of the codex-acp sidecar process.

**Backend Changes**:
- Deleted `src-tauri/src/remote/ssh_process.rs` (spawning remote codex-acp)
- Removed `externalBin` config from `src-tauri/tauri.conf.json`
- Updated module comments to reference codex-core instead of codex-acp

**Documentation Updates**:
- `AGENTS.md`: Removed codex-acp submodule and sidecar references
- `README.md`: Removed entire "codex-acp 启动策略" section, updated troubleshooting
- `scripts/AGENTS.md`: Removed fetch-codex-acp.mjs section
- `src-tauri/AGENTS.md`: Removed sidecar section
- `src-tauri/src/AGENTS.md`: Updated module map
- `src-tauri/src/codex/AGENTS.md`: Rewrote for codex-core integration
- `src-tauri/src/remote/AGENTS.md`: Removed ssh_process.rs reference

**Frontend Comment Updates**:
- `src/api/codex.ts`: Updated warmupCodex comment
- `src/hooks/useCodexEffects.ts`: Updated module comment
- `src/components/ui/feedback/Approval/types.ts`: Updated type comments
- `src/constants/chat.ts`: Updated comment

**Impact**:
- Frontend UI preserved (remote server management still works via SSH for browsing/git)
- No runtime behavior change for local sessions
- Simplified build process (no sidecar fetching required)

---

### Feature: History sessions loaded from rollout files

**Summary**:
Replace localStorage-based session persistence with rollout file-based history loading. Sessions are now loaded from `~/.codex/sessions/` directory on startup, providing true conversation context restoration.

**Architecture**:
- Removed `persist` middleware from `sessionStore` (no more localStorage for sessions)
- History sessions loaded from Rust backend via `codex_list_history` command
- Clicking history session triggers `resumeSession()` to restore backend context

**Backend Changes**:
- `src-tauri/src/codex/types.rs`: Added `HistoryItem` and `HistoryListResult` types
- `src-tauri/src/codex/core_service.rs`: Added `list_history()` method using `RolloutRecorder::list_threads()`
- `src-tauri/src/codex/commands.rs`: Added `codex_list_history` Tauri command
- `src-tauri/src/lib.rs`: Registered new command

**Frontend Changes**:
- `src/types/codex.ts`: Added `HistoryItem` and `HistoryListResult` types
- `src/api/codex.ts`: Added `listHistory()` API function
- `src/hooks/useHistoryList.ts`: New hook for loading history sessions
- `src/stores/sessionStore.ts`: Removed `persist` middleware, simplified to memory-only
- `src/App.tsx`: Integrated history list loading and session restoration

**User Experience**:
- App starts with a new empty session (same as before)
- Sidebar shows current sessions + history sessions from rollout files
- Clicking history session restores full conversation context from backend
- No behavior change for users, just different data source

**Testing**:
- Start app → new empty session displayed
- Sidebar shows history sessions from `~/.codex/sessions/`
- Click history session → conversation context restored

---

### Fix: Model selection not working on app startup

**Problem**: 
- Model selector showed "Select model" instead of the user's default model
- Users had to manually open settings panel to trigger model list loading

**Root Cause**:
1. `codex_warmup` command was not implemented in Rust backend
2. When `warmupCodex()` failed, the entire warmup flow was skipped (including `createSession()` which fetches the model list)
3. Additionally, `settingsStore` initialized with `DEFAULT_SETTINGS` instead of loading from localStorage synchronously, causing new sessions to use wrong default model

**Changes**:
- `src/stores/settingsStore.ts`: Added `loadSettingsSync()` to synchronously load settings from localStorage at module initialization
- `src/hooks/useCodexEffects.ts`: Separated `warmupCodex()` and `createSession()` into independent try-catch blocks, so session creation continues even if warmup command is unavailable

**Files Modified**:
- `src/stores/settingsStore.ts`
- `src/hooks/useCodexEffects.ts`

**Testing**:
- Start app → model list loads correctly
- New sessions use the default model from settings
- Settings panel only shows on first launch
