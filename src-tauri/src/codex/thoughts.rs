//! Helpers for gating thought chunk emission.

/// Environment flag controlling whether thought chunks are emitted.
pub const EMIT_THOUGHT_CHUNKS_ENV: &str = "CODEX_DESKTOP_EMIT_THOUGHT_CHUNKS";

/// Return true if thought chunks should be forwarded to the frontend.
pub fn emit_thought_chunks() -> bool {
    match std::env::var(EMIT_THOUGHT_CHUNKS_ENV) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.eq_ignore_ascii_case("0")
                || trimmed.eq_ignore_ascii_case("false")
                || trimmed.eq_ignore_ascii_case("no")
                || trimmed.eq_ignore_ascii_case("n")
                || trimmed.eq_ignore_ascii_case("off")
            {
                false
            } else if trimmed.eq_ignore_ascii_case("1")
                || trimmed.eq_ignore_ascii_case("true")
                || trimmed.eq_ignore_ascii_case("yes")
                || trimmed.eq_ignore_ascii_case("y")
                || trimmed.eq_ignore_ascii_case("on")
            {
                true
            } else {
                true
            }
        }
        Err(_) => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    fn lock_env() -> std::sync::MutexGuard<'static, ()> {
        ENV_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn with_env_var(value: Option<&str>, f: impl FnOnce()) {
        let _guard = lock_env();
        let prev = std::env::var(EMIT_THOUGHT_CHUNKS_ENV).ok();
        match value {
            Some(v) => std::env::set_var(EMIT_THOUGHT_CHUNKS_ENV, v),
            None => std::env::remove_var(EMIT_THOUGHT_CHUNKS_ENV),
        }
        f();
        match prev {
            Some(v) => std::env::set_var(EMIT_THOUGHT_CHUNKS_ENV, v),
            None => std::env::remove_var(EMIT_THOUGHT_CHUNKS_ENV),
        }
    }

    #[test]
    fn emit_thought_chunks_defaults_true() {
        with_env_var(None, || assert!(emit_thought_chunks()));
    }

    #[test]
    fn emit_thought_chunks_parses_truthy_values() {
        with_env_var(Some("1"), || assert!(emit_thought_chunks()));
        with_env_var(Some("true"), || assert!(emit_thought_chunks()));
        with_env_var(Some("YES"), || assert!(emit_thought_chunks()));
    }

    #[test]
    fn emit_thought_chunks_parses_falsy_values() {
        with_env_var(Some("0"), || assert!(!emit_thought_chunks()));
        with_env_var(Some("false"), || assert!(!emit_thought_chunks()));
        with_env_var(Some("off"), || assert!(!emit_thought_chunks()));
    }
}
