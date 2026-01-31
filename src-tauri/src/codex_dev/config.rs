//! Load and redact Codex CLI configuration for dev workflows.

use anyhow::{Context, Result};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Default)]
/// Parsed Codex CLI configuration values used by dev tooling.
pub struct CodexCliConfig {
    /// Optional model provider identifier.
    pub model_provider: Option<String>,
    /// Optional base URL override for the provider.
    pub base_url: Option<String>,
    /// Optional env key name for the provider.
    pub env_key: Option<String>,
    /// Optional API key loaded from config.
    pub api_key: Option<String>,
}

/// Resolve the default Codex home directory (e.g. `$HOME/.codex`).
pub fn codex_home_dir() -> Result<PathBuf> {
    let home = std::env::var_os("HOME").context("$HOME is not set")?;
    Ok(PathBuf::from(home).join(".codex"))
}

/// Load the Codex CLI config from the provided Codex home directory.
pub fn load_codex_cli_config(codex_home: &Path) -> Result<CodexCliConfig> {
    let config_path = codex_home.join("config.toml");
    let raw = fs::read_to_string(&config_path)
        .with_context(|| format!("failed to read {}", config_path.display()))?;
    let doc: toml::Value = toml::from_str(&raw)
        .with_context(|| format!("failed to parse {}", config_path.display()))?;

    let model_provider = get_string_by_any_key(
        &doc,
        &[
            "model_provider",
            "modelProvider",
            "model_provider_id",
            "modelProviderId",
        ],
    );
    let api_key = find_api_key(&doc, model_provider.as_deref());
    let base_url = find_base_url(&doc, model_provider.as_deref());
    let env_key = find_env_key(&doc, model_provider.as_deref());

    Ok(CodexCliConfig {
        model_provider,
        base_url,
        env_key,
        api_key,
    })
}

fn find_api_key(doc: &toml::Value, model_provider: Option<&str>) -> Option<String> {
    get_string_by_any_key(doc, &["api-key", "api_key", "apiKey"]).or_else(|| {
        model_provider.and_then(|provider| {
            get_string_by_path(doc, &[provider, "api-key"])
                .or_else(|| get_string_by_path(doc, &[provider, "api_key"]))
                .or_else(|| get_string_by_path(doc, &["model_providers", provider, "api-key"]))
                .or_else(|| get_string_by_path(doc, &["model_providers", provider, "api_key"]))
                .or_else(|| get_string_by_path(doc, &["providers", provider, "api-key"]))
                .or_else(|| get_string_by_path(doc, &["providers", provider, "api_key"]))
        })
    })
}

fn find_base_url(doc: &toml::Value, model_provider: Option<&str>) -> Option<String> {
    get_string_by_any_key(doc, &["base_url", "base-url", "baseUrl"]).or_else(|| {
        model_provider.and_then(|provider| {
            get_string_by_path(doc, &[provider, "base_url"])
                .or_else(|| get_string_by_path(doc, &[provider, "base-url"]))
                .or_else(|| get_string_by_path(doc, &[provider, "baseUrl"]))
                .or_else(|| get_string_by_path(doc, &["model_providers", provider, "base_url"]))
                .or_else(|| get_string_by_path(doc, &["model_providers", provider, "base-url"]))
                .or_else(|| get_string_by_path(doc, &["providers", provider, "base_url"]))
                .or_else(|| get_string_by_path(doc, &["providers", provider, "base-url"]))
        })
    })
}

fn find_env_key(doc: &toml::Value, model_provider: Option<&str>) -> Option<String> {
    get_string_by_any_key(doc, &["env_key", "env-key", "envKey"]).or_else(|| {
        model_provider.and_then(|provider| {
            get_string_by_path(doc, &[provider, "env_key"])
                .or_else(|| get_string_by_path(doc, &[provider, "env-key"]))
                .or_else(|| get_string_by_path(doc, &[provider, "envKey"]))
                .or_else(|| get_string_by_path(doc, &["model_providers", provider, "env_key"]))
                .or_else(|| get_string_by_path(doc, &["model_providers", provider, "env-key"]))
                .or_else(|| get_string_by_path(doc, &["model_providers", provider, "envKey"]))
                .or_else(|| get_string_by_path(doc, &["providers", provider, "env_key"]))
                .or_else(|| get_string_by_path(doc, &["providers", provider, "env-key"]))
                .or_else(|| get_string_by_path(doc, &["providers", provider, "envKey"]))
        })
    })
}

fn get_string_by_any_key(doc: &toml::Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = get_string_by_path(doc, &[key]) {
            return Some(value);
        }
    }
    None
}

fn get_string_by_path(doc: &toml::Value, path: &[&str]) -> Option<String> {
    let mut current = doc;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_str().map(|s| s.to_string())
}
