#![cfg(feature = "profile-events")]

use agent_client_protocol::{
    ContentBlock, ContentChunk, CurrentModeUpdate, Plan, PlanEntry, PlanEntryPriority,
    PlanEntryStatus, SessionModeId, SessionUpdate, TextContent, ToolCall, ToolCallId,
    ToolCallStatus, ToolCallUpdate, ToolCallUpdateFields, ToolKind,
};
use codex_desktop_lib::codex::{debug::DebugState, protocol::emit_session_update};
use std::time::Instant;
use tauri::test::mock_app;

const DEFAULT_COUNT: usize = 200_000;

#[derive(Clone, Copy, Debug)]
enum Mode {
    Mix,
    Message,
    Thought,
    ToolCall,
    ToolUpdate,
    Plan,
    CurrentMode,
}

struct Config {
    count: usize,
    mode: Mode,
}

#[test]
fn run_profile() {
    let cfg = parse_config();
    let app = mock_app();
    let handle = app.handle();
    let debug = DebugState::new();
    let session_id = "profile-session";

    let updates = build_updates();
    let update = pick_mode_update(cfg.mode, &updates);

    let start = Instant::now();
    for idx in 0..cfg.count {
        let current = match cfg.mode {
            Mode::Mix => &updates[idx % updates.len()],
            _ => update,
        };
        emit_session_update(handle, &debug, session_id, current);
    }
    let elapsed = start.elapsed();
    let elapsed_ms = elapsed.as_secs_f64() * 1000.0;
    let per_us = (elapsed.as_secs_f64() * 1_000_000.0) / cfg.count as f64;
    let rate = cfg.count as f64 / elapsed.as_secs_f64();

    eprintln!(
        "mode={:?} count={} elapsed_ms={:.2} per_event_us={:.2} rate={:.0}/s",
        cfg.mode, cfg.count, elapsed_ms, per_us, rate
    );
}

fn parse_config() -> Config {
    let count = std::env::var("CODEX_EVENT_PROFILE_COUNT")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .map(|value| value.max(1))
        .unwrap_or(DEFAULT_COUNT);
    let mode = std::env::var("CODEX_EVENT_PROFILE_MODE")
        .ok()
        .as_deref()
        .map(parse_mode)
        .unwrap_or(Mode::Mix);

    Config { count, mode }
}

fn parse_mode(value: &str) -> Mode {
    match value {
        "mix" => Mode::Mix,
        "message" => Mode::Message,
        "thought" => Mode::Thought,
        "tool_call" => Mode::ToolCall,
        "tool_update" => Mode::ToolUpdate,
        "plan" => Mode::Plan,
        "current_mode" => Mode::CurrentMode,
        _ => Mode::Mix,
    }
}

fn pick_mode_update<'a>(mode: Mode, updates: &'a [SessionUpdate]) -> &'a SessionUpdate {
    match mode {
        Mode::Mix => &updates[0],
        Mode::Message => &updates[0],
        Mode::Thought => &updates[1],
        Mode::ToolCall => &updates[2],
        Mode::ToolUpdate => &updates[3],
        Mode::Plan => &updates[4],
        Mode::CurrentMode => &updates[5],
    }
}

fn build_updates() -> Vec<SessionUpdate> {
    let message = SessionUpdate::AgentMessageChunk(ContentChunk::new(ContentBlock::Text(
        TextContent::new("hello from profiler"),
    )));
    let thought = SessionUpdate::AgentThoughtChunk(ContentChunk::new(ContentBlock::Text(
        TextContent::new("thinking..."),
    )));
    let tool_call = SessionUpdate::ToolCall(
        ToolCall::new(ToolCallId::new("tool-1"), "Read file").kind(ToolKind::Read),
    );
    let tool_update = SessionUpdate::ToolCallUpdate(ToolCallUpdate::new(
        ToolCallId::new("tool-1"),
        ToolCallUpdateFields::new().status(ToolCallStatus::InProgress),
    ));
    let plan = SessionUpdate::Plan(Plan::new(vec![PlanEntry::new(
        "Draft answer",
        PlanEntryPriority::High,
        PlanEntryStatus::InProgress,
    )]));
    let current_mode =
        SessionUpdate::CurrentModeUpdate(CurrentModeUpdate::new(SessionModeId::new("auto")));

    vec![message, thought, tool_call, tool_update, plan, current_mode]
}
