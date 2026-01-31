//! Event names emitted from the Codex backend.

/// Event emitted when a chat message chunk arrives.
pub const EVENT_MESSAGE_CHUNK: &str = "codex:message";
/// Event emitted when a thought chunk arrives.
pub const EVENT_THOUGHT_CHUNK: &str = "codex:thought";
/// Event emitted when a tool call is received.
pub const EVENT_TOOL_CALL: &str = "codex:tool-call";
/// Event emitted when a tool call update is received.
pub const EVENT_TOOL_CALL_UPDATE: &str = "codex:tool-call-update";
/// Event emitted when a permission request is needed.
pub const EVENT_APPROVAL_REQUEST: &str = "codex:approval-request";
/// Event emitted when a plan update arrives.
pub const EVENT_PLAN: &str = "codex:plan";
/// Event emitted when available slash commands are updated.
pub const EVENT_AVAILABLE_COMMANDS: &str = "codex:available-commands";
/// Event emitted when the current mode changes.
pub const EVENT_CURRENT_MODE: &str = "codex:current-mode";
/// Event emitted when config options are updated.
pub const EVENT_CONFIG_OPTION_UPDATE: &str = "codex:config-option-update";
/// Event emitted when a prompt turn completes.
pub const EVENT_TURN_COMPLETE: &str = "codex:turn-complete";
/// Event emitted when a backend error occurs.
pub const EVENT_ERROR: &str = "codex:error";
/// Event emitted with debug timing payloads.
pub const EVENT_DEBUG: &str = "codex:debug";
/// Event emitted for token usage updates.
pub const EVENT_TOKEN_USAGE: &str = "codex:token-usage";
