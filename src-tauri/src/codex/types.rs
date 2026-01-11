use agent_client_protocol::{
    AuthMethod, AvailableCommandsUpdate, ConfigOptionUpdate, CurrentModeUpdate, InitializeResponse,
    Plan, SessionConfigOption, SessionModeState, SessionModelState, SessionUpdate, ToolCall,
    ToolCallUpdate,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ApprovalDecision {
    AllowAlways,
    AllowOnce,
    RejectAlways,
    RejectOnce,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeResult {
    pub agent_info: serde_json::Value,
    pub auth_methods: Vec<AuthMethod>,
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
pub struct NewSessionResult {
    pub session_id: String,
    pub modes: Option<SessionModeState>,
    pub models: Option<SessionModelState>,
    pub config_options: Option<Vec<SessionConfigOption>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptResult {
    pub stop_reason: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum CodexEventPayload {
    MessageChunk { session_id: String, text: String },
    ThoughtChunk { session_id: String, text: String },
    ToolCall { session_id: String, tool_call: ToolCall },
    ToolCallUpdate { session_id: String, update: ToolCallUpdate },
    Plan { session_id: String, plan: Plan },
    AvailableCommandsUpdate { session_id: String, update: AvailableCommandsUpdate },
    CurrentModeUpdate { session_id: String, update: CurrentModeUpdate },
    ConfigOptionUpdate { session_id: String, update: ConfigOptionUpdate },
    UnknownSessionUpdate { session_id: String, update: SessionUpdate },
}
