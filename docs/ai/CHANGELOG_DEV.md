# Development Changelog

## 2026-02-01

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
