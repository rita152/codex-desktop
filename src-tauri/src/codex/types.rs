//! Serde-friendly data types used between backend and frontend.

use agent_client_protocol::{
    AuthMethod, AvailableCommandsUpdate, ConfigOptionUpdate, CurrentModeUpdate, InitializeResponse,
    Plan, SessionConfigOption, SessionModeState, SessionModelState, SessionUpdate, ToolCall,
    ToolCallUpdate,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
/// User decision for permission requests.
pub enum ApprovalDecision {
    /// Allow the action for all future requests.
    AllowAlways,
    /// Allow the action once.
    AllowOnce,
    /// Reject the action for all future requests.
    RejectAlways,
    /// Reject the action once.
    RejectOnce,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
/// JSON-friendly result returned from initialize.
pub struct InitializeResult {
    /// Agent metadata as JSON.
    pub agent_info: serde_json::Value,
    /// Supported authentication methods.
    pub auth_methods: Vec<AuthMethod>,
    /// Negotiated protocol version as JSON.
    pub protocol_version: serde_json::Value,
}

impl From<InitializeResponse> for InitializeResult {
    fn from(value: InitializeResponse) -> Self {
        // Keep this JSON-friendly so the frontend can evolve without a tight Rust/TS lockstep.
        Self {
            agent_info: serde_json::to_value(value.agent_info).unwrap_or(serde_json::Value::Null),
            auth_methods: value.auth_methods,
            protocol_version: serde_json::to_value(value.protocol_version)
                .unwrap_or(serde_json::Value::Null),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
/// JSON-friendly session creation result.
pub struct NewSessionResult {
    /// ACP session identifier.
    pub session_id: String,
    /// Available modes and current selection.
    pub modes: Option<SessionModeState>,
    /// Available models and current selection.
    pub models: Option<SessionModelState>,
    /// Additional config options for the session.
    pub config_options: Option<Vec<SessionConfigOption>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
/// JSON-friendly prompt completion result.
pub struct PromptResult {
    /// ACP stop reason value.
    pub stop_reason: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
/// JSON-friendly Codex CLI config summary.
pub struct CodexCliConfigInfo {
    /// Resolved Codex home directory.
    pub codex_home: String,
    /// Resolved config.toml path.
    pub config_path: String,
    /// Whether config.toml exists.
    pub config_found: bool,
    /// Selected model provider id.
    pub model_provider: Option<String>,
    /// Provider base URL.
    pub base_url: Option<String>,
    /// Provider env key name.
    pub env_key: Option<String>,
    /// Whether auth.json exists.
    pub auth_file_found: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
/// Union of frontend event payloads emitted by the backend.
pub enum CodexEventPayload {
    /// Assistant/user message chunk update.
    MessageChunk { session_id: String, text: String },
    /// Assistant thought chunk update.
    ThoughtChunk { session_id: String, text: String },
    /// New tool call information.
    ToolCall {
        session_id: String,
        tool_call: ToolCall,
    },
    /// Tool call progress update.
    ToolCallUpdate {
        session_id: String,
        update: ToolCallUpdate,
    },
    /// Plan update emitted by the agent.
    Plan { session_id: String, plan: Plan },
    /// Available command list update.
    AvailableCommandsUpdate {
        session_id: String,
        update: AvailableCommandsUpdate,
    },
    /// Current mode update.
    CurrentModeUpdate {
        session_id: String,
        update: CurrentModeUpdate,
    },
    /// Config option update.
    ConfigOptionUpdate {
        session_id: String,
        update: ConfigOptionUpdate,
    },
    /// Session update that does not match known variants.
    UnknownSessionUpdate {
        session_id: String,
        update: SessionUpdate,
    },
}
