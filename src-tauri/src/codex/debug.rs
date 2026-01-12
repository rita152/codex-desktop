use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};

use super::events::EVENT_DEBUG;

#[derive(Debug, Clone)]
pub struct DebugTiming {
    pub ts_ms: u64,
    pub dt_ms: u64,
    pub since_prompt_ms: Option<u64>,
    pub since_last_event_ms: Option<u64>,
}

#[derive(Debug)]
pub struct DebugState {
    start: Instant,
    start_epoch_ms: u64,
    last_event_by_session: Mutex<HashMap<String, Instant>>,
    last_prompt_by_session: Mutex<HashMap<String, Instant>>,
    emit_to_stderr: bool,
}

impl DebugState {
    pub fn new() -> Self {
        let start_epoch_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            .try_into()
            .unwrap_or(u64::MAX);
        let emit_to_stderr = std::env::var("CODEX_DEBUG_TIMING").is_ok();

        Self {
            start: Instant::now(),
            start_epoch_ms,
            last_event_by_session: Mutex::new(HashMap::new()),
            last_prompt_by_session: Mutex::new(HashMap::new()),
            emit_to_stderr,
        }
    }

    pub fn mark_prompt(&self, session_id: &str) -> DebugTiming {
        let now = Instant::now();
        self.last_prompt_by_session
            .lock()
            .expect("debug prompt mutex poisoned")
            .insert(session_id.to_string(), now);
        let since_last = self.update_last_event(session_id, now);

        DebugTiming {
            ts_ms: self.now_ms(),
            dt_ms: self.dt_ms(),
            since_prompt_ms: None,
            since_last_event_ms: since_last,
        }
    }

    pub fn mark_event(&self, session_id: &str) -> DebugTiming {
        let now = Instant::now();
        let since_prompt = self
            .last_prompt_by_session
            .lock()
            .expect("debug prompt mutex poisoned")
            .get(session_id)
            .map(|t| now.duration_since(*t).as_millis().try_into().unwrap_or(u64::MAX));
        let since_last = self.update_last_event(session_id, now);

        DebugTiming {
            ts_ms: self.now_ms(),
            dt_ms: self.dt_ms(),
            since_prompt_ms: since_prompt,
            since_last_event_ms: since_last,
        }
    }

    pub fn mark_global(&self) -> DebugTiming {
        DebugTiming {
            ts_ms: self.now_ms(),
            dt_ms: self.dt_ms(),
            since_prompt_ms: None,
            since_last_event_ms: None,
        }
    }

    pub fn emit(
        &self,
        app: &AppHandle,
        session_id: Option<&str>,
        label: &str,
        timing: DebugTiming,
        extra: Value,
    ) {
        let payload = json!({
            "label": label,
            "sessionId": session_id,
            "tsMs": timing.ts_ms,
            "dtMs": timing.dt_ms,
            "sincePromptMs": timing.since_prompt_ms,
            "sinceLastEventMs": timing.since_last_event_ms,
            "extra": extra,
        });

        let _ = app.emit(EVENT_DEBUG, payload.clone());
        if self.emit_to_stderr {
            eprintln!("{payload}");
        }
    }

    fn update_last_event(&self, session_id: &str, now: Instant) -> Option<u64> {
        let mut guard = self
            .last_event_by_session
            .lock()
            .expect("debug event mutex poisoned");
        let since_last = guard
            .get(session_id)
            .map(|t| now.duration_since(*t).as_millis().try_into().unwrap_or(u64::MAX));
        guard.insert(session_id.to_string(), now);
        since_last
    }

    fn now_ms(&self) -> u64 {
        self.start_epoch_ms
            .saturating_add(self.start.elapsed().as_millis().try_into().unwrap_or(u64::MAX))
    }

    fn dt_ms(&self) -> u64 {
        self.start.elapsed().as_millis().try_into().unwrap_or(u64::MAX)
    }
}
