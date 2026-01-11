// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub mod codex_dev;

#[tauri::command]
async fn codex_dev_prompt_once(window: tauri::Window, cwd: String, content: String) -> Result<(), String> {
    let cwd = std::path::PathBuf::from(cwd);
    codex_dev::run::prompt_once(window, cwd, content)
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, codex_dev_prompt_once])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
