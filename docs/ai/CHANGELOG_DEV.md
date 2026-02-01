# Development Changelog

## 2026-02-01

### Feature: Collapsible ToolCallGroup for parallel commands

**Summary**:
Added `ToolCallGroup` component to group and collapse multiple parallel tool calls. When 3+ consecutive toolcalls appear in the Working panel, they are automatically grouped into a collapsible section showing summary status.

**Files Added**:
- `src/components/ui/feedback/ToolCallGroup/index.tsx`: Main component
- `src/components/ui/feedback/ToolCallGroup/types.ts`: Type definitions
- `src/components/ui/feedback/ToolCallGroup/ToolCallGroup.css`: Styles

**Files Modified**:
- `src/components/ui/feedback/Working/index.tsx`: Added grouping logic with `groupItems()` function

**Key Changes**:
1. `ToolCallGroup` displays collapsed summary: "15 parallel commands"
2. Shows aggregated status: running count, completion count, failures
3. Click to expand and see individual tool calls
4. Real-time elapsed time tracking for in-progress groups
5. `Working` component groups consecutive toolcalls (MIN_GROUP_SIZE=3)

**Grouping Logic**:
```typescript
function groupItems(items: WorkingItem[]): GroupedItem[] {
  // Consecutive toolcalls → ToolCallGroup (if >= MIN_GROUP_SIZE)
  // Other items → single items
}
```

**UI Result**:
```
Before:
┌ Working ────────────────────────────┐
│ exec: ls -la                    ✓   │
│ exec: cat package.json          ✓   │
│ exec: git status                ✓   │
│ exec: npm run build             ⟳   │
│ ... (15 more items)                 │
└─────────────────────────────────────┘

After:
┌ Working ────────────────────────────┐
│ 📦 15 parallel commands   12/15 ✓   │  ← Collapsed by default
│   └─ Click to expand               │
└─────────────────────────────────────┘
```

**Impact**: Significantly reduces UI clutter when AI agent executes many parallel shell commands.

---

### Enhancement: Multi-Thinking blocks for status headers (TUI-inspired)

**Summary**:
Implemented TUI's design where each `**bold**` status header creates a NEW Thinking component. When a new `**...**` appears in the thinking stream, the current thought is finalized and a new one begins.

**Files Modified**:
- `src/hooks/codexEventMessageHandlers.ts`: Modified `appendThoughtChunk` to split by `**...**` headers
- `src/components/ui/feedback/Thinking/index.tsx`: Added `extractLastBoldHeader` for label display

**Changes**:
1. `appendThoughtChunk` now detects new `**...**` headers by comparing bold count
2. When new header detected, splits content into multiple thought messages
3. Each thought message = one Thinking component
4. Previous thoughts are finalized (phase='done'), only last one streams
5. Thinking component extracts header for label display

**Key Logic** (event handler):
```typescript
const prevBoldCount = countBoldHeaders(currentContent);
const nextBoldCount = countBoldHeaders(nextContent);

if (nextBoldCount > prevBoldCount) {
  // Split into multiple thought messages
  const sections = splitByBoldHeaders(nextContent);
  // Create one Message per section
}
```

**Display Result**:
```
┌─────────────────────────────────────┐
│ 🧠 Analyzing current project · 3秒  │  ← Thought 1 (done)
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 🧠 Planning project analysis · 2秒  │  ← Thought 2 (done)
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 🧠 Scanning repository · 5秒        │  ← Thought 3 (streaming)
│   I'm starting by scanning...       │  ← Body WITHOUT **header**
└─────────────────────────────────────┘
```

**Header Deduplication**:
- Header extracted to label → `removeLeadingBoldHeader()` removes it from body
- Body displays clean content without `**Scanning repository**` prefix

**Impact**: Multiple Thinking components per prompt when content has multiple `**...**` headers. Each phase is independently collapsible. No duplicate headers in body.

---

### Enhancement: Frontend event listeners for new codex-core events

**Summary**:
Added frontend event listeners and state management for the 11 new Tauri events.

**Files Modified**:
- `src/types/codex.ts`: Added 11 new event type definitions
- `src/hooks/useCodexEvents.ts`: Added 11 new event listeners
- `src/stores/codexStore.ts`: Added state and actions for user input, dynamic tools, elicitation, and undo

**New Event Handlers**:

| Event | Handler Action |
|-------|----------------|
| `codex:thread-name-updated` | Updates session title in sessionStore |
| `codex:thread-rolled-back` | Shows system message about context rollback |
| `codex:request-user-input` | Registers in `pendingUserInputRequests` |
| `codex:dynamic-tool-call` | Registers in `pendingDynamicToolCalls` |
| `codex:elicitation-request` | Registers in `pendingElicitationRequests` |
| `codex:view-image` | Creates tool call message for image display |
| `codex:terminal-interaction` | Updates tool call with stdin info |
| `codex:undo-started` | Sets `undoInProgress` state |
| `codex:undo-completed` | Clears undo state, shows result message |
| `codex:deprecation-notice` | Shows warning message to user |
| `codex:background-event` | Logs to console (no UI display) |

**New Selectors Added**:
- `usePendingUserInputRequests(sessionId)`
- `usePendingDynamicToolCalls(sessionId)`
- `usePendingElicitationRequests(sessionId)`
- `useIsUndoInProgress(sessionId)`

**Impact**:
- Frontend can now receive and process all newly forwarded events
- UI components can use selectors to display pending requests
- Undo status can be shown in UI

---

### Enhancement: Complete event bridge coverage for codex-core EventMsg

**Summary**:
Added missing event type forwarding from codex-core to frontend. Previously ~22 event types were not being forwarded to the frontend.

**New Events Added** (12 types):

| Category | Event | Tauri Event Name |
|----------|-------|------------------|
| Thread | `ThreadNameUpdated` | `codex:thread-name-updated` |
| Thread | `ThreadRolledBack` | `codex:thread-rolled-back` |
| User Input | `RequestUserInput` | `codex:request-user-input` |
| User Input | `DynamicToolCallRequest` | `codex:dynamic-tool-call` |
| User Input | `ElicitationRequest` | `codex:elicitation-request` |
| Tool | `ViewImageToolCall` | `codex:view-image` |
| Tool | `TerminalInteraction` | `codex:terminal-interaction` |
| Undo | `UndoStarted` | `codex:undo-started` |
| Undo | `UndoCompleted` | `codex:undo-completed` |
| Notification | `DeprecationNotice` | `codex:deprecation-notice` |
| Notification | `BackgroundEvent` | `codex:background-event` |

**Files Modified**:
- `src-tauri/src/codex/events.rs`: Added 12 new event constants
- `src-tauri/src/codex/event_bridge.rs`: Added handling for 12 new event types

**Events Still Not Forwarded** (intentionally):
- Request-response events: `GetHistoryEntryResponse`, `McpListToolsResponse`, `ListCustomPromptsResponse`, `ListSkillsResponse`
- Alternative delta events: `AgentReasoningRawContent*`, `AgentMessageContentDelta`, `ReasoningContentDelta`, `PlanDelta`
- Internal events: `ShutdownComplete`, `SkillsUpdateAvailable`, `TurnDiff`
- Collab events: `CollabAgent*`, `CollabWaiting*`, `CollabClose*`
- Review mode events: `EnteredReviewMode`, `ExitedReviewMode`
- Low-level events: `RawResponseItem`, `ItemStarted`, `ItemCompleted`

**Impact**:
- Frontend can now receive and potentially handle thread name updates, undo operations, user input requests, etc.
- Note: Frontend UI components for these new events need to be implemented separately

**Testing**:
- Rust backend compiles successfully
- No breaking changes to existing event handling

---

### Fix: History conversation messages not loading

**Problem**:
- Clicking a history session in Sidebar would select it but show empty chat area
- Historical user and assistant messages were not displayed

**Root Cause**:
1. `SessionConfigured` event (containing `initial_messages`) was consumed by `finalize_thread_spawn` in codex-core
2. Desktop's `event_loop` never received this event because it was already consumed
3. `initial_messages` were never replayed to the frontend

**Solution**:
1. In `core_service.rs`, manually emit `SessionConfigured` event after `resume_thread_from_rollout` returns
2. The `session_configured` is now properly accessed from `NewThread` and emitted via `emit_codex_event`
3. `event_bridge.rs` replays `initial_messages` (UserMessage and AgentMessage) to frontend

**Files Modified**:
- `src-tauri/src/codex/core_service.rs`: Emit `SessionConfigured` event manually for resumed sessions
- `src-tauri/src/codex/event_bridge.rs`: Handle `EventMsg::UserMessage`, replay initial messages
- `src-tauri/src/codex/events.rs`: Added `EVENT_USER_MESSAGE` constant
- `src/hooks/useCodexEvents.ts`: Listen for `codex:user-message` event
- `src/App.tsx`: Pre-register session mapping before `resumeSession` call

**Testing**:
- Click history session → previous conversation messages load and display correctly
- Both user messages and assistant messages are restored

---

### Fix: History sessions not showing in Sidebar

**Problem**:
- Sidebar did not display any history sessions
- `codex_list_history` command failed with "codex service not initialized" error

**Root Cause 1 - Initialization Order**:
- `useHistoryList` hook called `listHistory()` immediately on component mount
- But `codex_list_history` Tauri command required `codex_init` to complete first
- Result: history loading always failed because service wasn't initialized yet

**Root Cause 2 - Data Format Mismatch**:
- `RolloutRecorder::list_threads` returns `head` as parsed payload content (flat structure)
- `extract_session_info` expected nested format `{"type": "session_meta", "payload": {...}}`
- Result: all items were filtered out, returning 0 history items

**Solution**:
1. Made `codex_list_history` command independent of `CodexCoreService` initialization
2. Fixed `extract_session_info` to extract `id`/`cwd` directly from head elements

**Files Modified**:
- `src-tauri/src/codex/commands.rs`: Rewrote `codex_list_history` to be self-contained, fixed data parsing
- `src/App.tsx`: Changed history list size from 50 to 10

**Testing**:
- Start app → Sidebar shows recent 10 history sessions immediately
- Click history session → conversation context restored

---

### Feature: Sidebar grouped display for active and history sessions

**Summary**:
Sidebar now displays active sessions (current app session) and history sessions (from rollout files) in separate groups with a visual divider.

**Changes**:
- `src/components/business/Sidebar/types.ts`: Added `historySessions` prop
- `src/components/business/Sidebar/index.tsx`: Separate rendering for active and history groups
- `src/components/business/Sidebar/Sidebar.css`: Added `.sidebar__section-divider` styles
- `src/components/business/ChatContainer/types.ts`: Added `historySessions` prop
- `src/components/business/ChatContainer/index.tsx`: Pass `historySessions` to Sidebar
- `src/App.tsx`: Pass `activeSessions` and `historySessions` separately
- `src/i18n/locales/zh-CN.json`: Added `sidebar.history` translation
- `src/i18n/locales/en-US.json`: Added `sidebar.history` translation

**UI**:
- Active sessions shown at top (no divider)
- History sessions shown below with "历史对话 / History" section header

---

### Fix: History session messages not loading when resumed

**Problem**:
- Clicking a history session restored the session but didn't display the conversation history
- The session would appear blank until a new message was sent

**Root Cause**:
- `SessionConfiguredEvent` contains `initial_messages` field with history messages
- Desktop `event_bridge.rs` only logged the event, did not replay `initial_messages`
- `UserMessage` events were not handled in event_bridge

**Solution**:
1. Added handling for `SessionConfiguredEvent.initial_messages` in `event_bridge.rs`
2. Added `EventMsg::UserMessage` event handling (emits `codex:user-message`)
3. Added `codex:user-message` listener in frontend `useCodexEvents.ts`
4. Send `turn-complete` after replay to finalize streaming state

**Files Modified**:
- `src-tauri/src/codex/events.rs`: Added `EVENT_USER_MESSAGE` constant
- `src-tauri/src/codex/event_bridge.rs`: Added UserMessage handling, initial_messages replay
- `src/hooks/useCodexEvents.ts`: Added `codex:user-message` event listener
- `src/App.tsx`: Added `registerCodexSession` call in `handleSessionSelect`

**Root Cause Details**:
1. When restoring a history session, `registerCodexSession` was called AFTER `resumeSession` returned
2. But `SessionConfigured` event (containing `initial_messages`) is sent DURING `resumeSession`
3. When the event arrived, the session mapping didn't exist yet
4. `resolveChatSessionId` returned null, causing all history events to be silently dropped

**Solution**:
- Pre-register the session mapping BEFORE calling `resumeSession`
- The history item ID equals the codex session ID (both are the original thread ID from rollout)
- This ensures events can be routed correctly as they arrive

**Testing**:
- Click history session → conversation history loads and displays
- Both user messages and assistant messages are restored

---

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
