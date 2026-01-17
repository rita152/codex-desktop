use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

const TERMINAL_OUTPUT_EVENT: &str = "terminal-output";
const TERMINAL_EXIT_EVENT: &str = "terminal-exit";
const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;

#[derive(Default)]
pub struct TerminalManager {
    counter: AtomicUsize,
    terminals: Mutex<HashMap<String, TerminalInstance>>,
}

struct TerminalInstance {
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutput<'a> {
    terminal_id: &'a str,
    data: &'a str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExit<'a> {
    terminal_id: &'a str,
}

impl TerminalManager {
    fn next_id(&self) -> String {
        let id = self.counter.fetch_add(1, Ordering::Relaxed);
        format!("term-{}", id)
    }
}

fn default_shell() -> String {
    if cfg!(windows) {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

#[tauri::command]
pub fn terminal_spawn(
    app: AppHandle,
    state: State<'_, TerminalManager>,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<String, String> {
    let cols = cols.filter(|value| *value > 0).unwrap_or(DEFAULT_COLS);
    let rows = rows.filter(|value| *value > 0).unwrap_or(DEFAULT_ROWS);
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| err.to_string())?;

    let mut cmd = CommandBuilder::new(default_shell());
    cmd.env("TERM", "xterm-256color");
    if let Some(path) = cwd {
        let trimmed = path.trim();
        if !trimmed.is_empty() && Path::new(trimmed).exists() {
            cmd.cwd(trimmed);
        }
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|err| err.to_string())?;
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| err.to_string())?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|err| err.to_string())?;

    let id = state.next_id();
    let writer = Arc::new(Mutex::new(writer));
    let child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>> =
        Arc::new(Mutex::new(child));

    {
        let mut terminals = state
            .terminals
            .lock()
            .map_err(|_| "terminal manager poisoned".to_string())?;
        terminals.insert(
            id.clone(),
            TerminalInstance {
                master: pair.master,
                writer: Arc::clone(&writer),
                child: Arc::clone(&child),
            },
        );
    }

    let terminal_id = id.clone();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(bytes) => {
                    match std::str::from_utf8(&buffer[..bytes]) {
                        Ok(text) => {
                            let _ = app_handle.emit(
                                TERMINAL_OUTPUT_EVENT,
                                TerminalOutput {
                                    terminal_id: terminal_id.as_str(),
                                    data: text,
                                },
                            );
                        }
                        Err(_) => {
                            let text = String::from_utf8_lossy(&buffer[..bytes]).into_owned();
                            let _ = app_handle.emit(
                                TERMINAL_OUTPUT_EVENT,
                                TerminalOutput {
                                    terminal_id: terminal_id.as_str(),
                                    data: text.as_str(),
                                },
                            );
                        }
                    }
                }
                Err(_) => break,
            }
        }

        let _ = app_handle.emit(
            TERMINAL_EXIT_EVENT,
            TerminalExit {
                terminal_id: terminal_id.as_str(),
            },
        );
    });

    Ok(id)
}

#[tauri::command]
pub fn terminal_write(
    state: State<'_, TerminalManager>,
    terminal_id: String,
    data: String,
) -> Result<(), String> {
    let writer = {
        let terminals = state
            .terminals
            .lock()
            .map_err(|_| "terminal manager poisoned".to_string())?;
        let terminal = terminals
            .get(&terminal_id)
            .ok_or_else(|| "terminal not found".to_string())?;
        Arc::clone(&terminal.writer)
    };
    let mut writer = writer
        .lock()
        .map_err(|_| "terminal writer poisoned".to_string())?;
    writer.write_all(data.as_bytes()).map_err(|err| err.to_string())?;
    writer.flush().map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn terminal_resize(
    state: State<'_, TerminalManager>,
    terminal_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let cols = if cols == 0 { DEFAULT_COLS } else { cols };
    let rows = if rows == 0 { DEFAULT_ROWS } else { rows };
    let terminals = state
        .terminals
        .lock()
        .map_err(|_| "terminal manager poisoned".to_string())?;
    let terminal = terminals
        .get(&terminal_id)
        .ok_or_else(|| "terminal not found".to_string())?;
    terminal
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn terminal_kill(
    state: State<'_, TerminalManager>,
    terminal_id: String,
) -> Result<(), String> {
    let terminal = {
        let mut terminals = state
            .terminals
            .lock()
            .map_err(|_| "terminal manager poisoned".to_string())?;
        terminals.remove(&terminal_id)
    };

    if let Some(terminal) = terminal {
        if let Ok(mut child) = terminal.child.lock() {
            let _ = child.kill();
        }
    }

    Ok(())
}
