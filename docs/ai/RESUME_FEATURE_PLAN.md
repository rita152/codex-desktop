# Resume Feature Implementation Plan

**Created:** 2026-02-01
**Status:** Planning
**Approach:** Plan A - Rollout File Based Resume

---

## 1. Background

### Current Behavior
- App startup: creates a new chat session (after recent change)
- Session switch: creates a new codex thread, loses conversation context
- History messages: stored only in frontend `sessionStore`, not sent to backend

### Problem
When user switches to a historical session or restarts the app, the AI loses all conversation context, resulting in poor continuity.

### Goal
Implement resume functionality so that:
1. Switching to a historical session restores the full conversation context
2. AI can continue the conversation with full awareness of prior exchanges

---

## 2. Technical Approach

### Why Plan A (Rollout File Based Resume)

| Factor | Plan A | Plan B | Plan C |
|--------|--------|--------|--------|
| codex-core alignment | ✅ Native API | ⚠️ Format conversion | ❌ Bypass |
| Token efficiency | ✅ Auto-compaction | ⚠️ Medium | ❌ Full history every time |
| Context completeness | ✅ Tool calls, approvals | ⚠️ May lose data | ⚠️ Text only |
| Maintenance cost | ✅ Low | ❌ High | ✅ Low |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  sessionStore                                                    │
│  ├── sessions: ChatSession[]                                     │
│  ├── sessionMessages: Record<string, Message[]>                  │
│  └── codexThreadInfo: Record<chatId, {threadId, rolloutPath}>   │ ← NEW
├─────────────────────────────────────────────────────────────────┤
│  useCodexEffects.ts                                              │
│  └── ensureCodexSession(chatSessionId)                          │
│      ├── if rolloutPath exists → resumeSession(rolloutPath)     │ ← MODIFIED
│      └── else → createSession(cwd)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ invoke()
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Rust/Tauri)                        │
├─────────────────────────────────────────────────────────────────┤
│  commands.rs                                                     │
│  ├── codex_create_session → returns {sessionId, rolloutPath}    │ ← MODIFIED
│  └── codex_resume_session(rolloutPath) → returns {sessionId}    │ ← NEW
├─────────────────────────────────────────────────────────────────┤
│  core_service.rs                                                 │
│  ├── create_session() → thread_manager.start_thread()           │
│  │   └── capture rollout_path from NewThread                    │ ← MODIFIED
│  └── resume_session() → thread_manager.resume_thread_from_rollout│ ← NEW
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ direct call
┌─────────────────────────────────────────────────────────────────┐
│                      codex-core (unchanged)                      │
├─────────────────────────────────────────────────────────────────┤
│  ThreadManager                                                   │
│  ├── start_thread(config) → NewThread {thread, thread_id, ...}  │
│  └── resume_thread_from_rollout(config, rollout_path, auth)     │ ← USED
│                                                                  │
│  Rollout files: ~/.codex/rollouts/<thread_id>.jsonl             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Steps

### Phase 1: Backend Support

#### 1.1 Modify `NewSessionResult` type
**File:** `src-tauri/src/codex/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewSessionResult {
    pub session_id: String,
    pub rollout_path: Option<String>,  // NEW: path to rollout file
    // ... existing fields
}
```

#### 1.2 Capture rollout_path in `create_session`
**File:** `src-tauri/src/codex/core_service.rs`

Modify `create_session` to extract and return `rollout_path` from the `NewThread` result.

#### 1.3 Add `resume_session` method
**File:** `src-tauri/src/codex/core_service.rs`

```rust
pub async fn resume_session(
    &self,
    rollout_path: PathBuf,
    cwd: PathBuf,
) -> Result<NewSessionResult> {
    let config = self.build_config(cwd)?;
    let NewThread { thread, thread_id, .. } = self
        .thread_manager
        .resume_thread_from_rollout(config, rollout_path.clone(), self.auth_manager.clone())
        .await?;
    
    // Register session and start event bridge
    // ...
    
    Ok(NewSessionResult {
        session_id: thread_id.to_string(),
        rollout_path: Some(rollout_path.to_string_lossy().to_string()),
        // ...
    })
}
```

#### 1.4 Add Tauri command
**File:** `src-tauri/src/codex/commands.rs`

```rust
#[tauri::command]
pub async fn codex_resume_session(
    state: State<'_, CodexState>,
    rollout_path: String,
    cwd: Option<String>,
) -> Result<NewSessionResult, String> {
    // ...
}
```

#### 1.5 Register command
**File:** `src-tauri/src/lib.rs`

Add `codex_resume_session` to `generate_handler![...]`.

---

### Phase 2: Frontend API

#### 2.1 Add `resumeSession` API
**File:** `src/api/codex.ts`

```typescript
export interface NewSessionResult {
  sessionId: string;
  rolloutPath?: string;
  // ... existing fields
}

export async function resumeSession(
  rolloutPath: string,
  cwd?: string
): Promise<NewSessionResult> {
  return invoke<NewSessionResult>('codex_resume_session', {
    rolloutPath,
    rollout_path: rolloutPath,  // snake_case for Rust
    cwd,
  });
}
```

#### 2.2 Update `createSession` return type
**File:** `src/api/codex.ts`

Ensure `createSession` returns `rolloutPath` in the result.

---

### Phase 3: State Persistence

#### 3.1 Add `codexThreadInfo` to sessionStore
**File:** `src/stores/sessionStore.ts`

```typescript
interface SessionState {
  // ... existing fields
  
  // NEW: Map chatSessionId → codex thread info for resume
  codexThreadInfo: Record<string, { threadId: string; rolloutPath: string }>;
}

// Update partialize to persist this field
partialize: (state) => ({
  sessions: state.sessions,
  selectedSessionId: state.selectedSessionId,
  sessionMessages: state.sessionMessages,
  sessionDrafts: state.sessionDrafts,
  codexThreadInfo: state.codexThreadInfo,  // NEW
}),
```

#### 3.2 Add actions for codexThreadInfo
**File:** `src/stores/sessionStore.ts`

```typescript
interface SessionActions {
  // ... existing actions
  
  setCodexThreadInfo: (chatSessionId: string, info: { threadId: string; rolloutPath: string }) => void;
  clearCodexThreadInfo: (chatSessionId: string) => void;
}
```

---

### Phase 4: Resume Logic

#### 4.1 Modify `ensureCodexSession`
**File:** `src/hooks/useCodexEffects.ts`

```typescript
const ensureCodexSession = useCallback(
  async (chatSessionId: string): Promise<string> => {
    const codexStore = useCodexStore.getState();
    const sessionStore = useSessionStore.getState();
    
    // Check if session already active
    const existing = codexStore.getCodexSessionId(chatSessionId);
    if (existing) return existing;
    
    // Check if we have rollout info for resume
    const threadInfo = sessionStore.codexThreadInfo[chatSessionId];
    
    if (threadInfo?.rolloutPath) {
      try {
        // Try to resume from rollout
        const result = await resumeSession(threadInfo.rolloutPath, sessionMeta?.cwd);
        codexStore.registerCodexSession(chatSessionId, result.sessionId);
        return result.sessionId;
      } catch (err) {
        // Fallback to new session if resume fails (e.g., rollout file deleted)
        console.warn('[codex] resume failed, creating new session:', err);
      }
    }
    
    // Create new session
    const result = await createSession(cwd);
    codexStore.registerCodexSession(chatSessionId, result.sessionId);
    
    // Save thread info for future resume
    if (result.rolloutPath) {
      sessionStore.setCodexThreadInfo(chatSessionId, {
        threadId: result.sessionId,
        rolloutPath: result.rolloutPath,
      });
    }
    
    return result.sessionId;
  },
  [/* dependencies */]
);
```

---

## 4. File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src-tauri/src/codex/types.rs` | Modify | Add `rollout_path` to `NewSessionResult` |
| `src-tauri/src/codex/core_service.rs` | Modify | Capture rollout_path, add `resume_session` |
| `src-tauri/src/codex/commands.rs` | Modify | Add `codex_resume_session` command |
| `src-tauri/src/lib.rs` | Modify | Register new command |
| `src/api/codex.ts` | Modify | Add `resumeSession`, update types |
| `src/stores/sessionStore.ts` | Modify | Add `codexThreadInfo` state and actions |
| `src/hooks/useCodexEffects.ts` | Modify | Implement resume-first logic |

---

## 5. Testing Plan

### Unit Tests

1. **Backend**
   - `resume_session` returns correct session info
   - `resume_session` handles missing rollout file gracefully

2. **Frontend**
   - `codexThreadInfo` persists correctly
   - `ensureCodexSession` tries resume before create

### Integration Tests

1. **Resume Flow**
   - Create session → get rolloutPath → close app → reopen → resume succeeds
   - AI remembers previous conversation context

2. **Fallback Flow**
   - Delete rollout file → resume fails → falls back to new session

3. **Session Switch**
   - Session A (has history) → Session B → back to Session A → context restored

### Manual Testing

1. Start app, have a conversation
2. Close app, restart
3. Switch to historical session
4. Verify AI remembers context (ask "what did we discuss?")

---

## 6. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Rollout file deleted | Medium | Resume fails | Fallback to new session, log warning |
| Rollout file corrupted | Low | Resume fails | Fallback to new session, consider cleanup |
| Large rollout file | Low | Slow resume | codex-core has built-in compaction |
| codex-core API change | Low | Build failure | Pin codex-core version, monitor upstream |

---

## 7. Future Enhancements

1. **UI Indicator**: Show "Resuming conversation..." during resume
2. **Session Badge**: Mark sessions as "resumed" vs "new"
3. **Manual Refresh**: Allow user to manually clear context and start fresh
4. **Export/Import**: Allow exporting rollout files for backup

---

## 8. Dependencies

- **codex-core**: No changes required (uses existing `resume_thread_from_rollout` API)
- **Frontend**: React 19, Zustand, TypeScript
- **Backend**: Tauri 2, Rust

---

## Appendix: codex-core Resume API Reference

```rust
// From codex-core/src/thread_manager.rs

pub async fn resume_thread_from_rollout(
    &self,
    config: Config,
    rollout_path: PathBuf,
    auth_manager: Arc<AuthManager>,
) -> CodexResult<NewThread> {
    let initial_history = RolloutRecorder::get_rollout_history(&rollout_path).await?;
    self.resume_thread_with_history(config, initial_history, auth_manager)
        .await
}

pub async fn resume_thread_with_history(
    &self,
    config: Config,
    initial_history: InitialHistory,
    auth_manager: Arc<AuthManager>,
) -> CodexResult<NewThread> {
    self.state
        .spawn_thread(config, initial_history, auth_manager, self.agent_control(), Vec::new())
        .await
}
```

Rollout files are stored at: `~/.codex/rollouts/<thread_id>.jsonl`
