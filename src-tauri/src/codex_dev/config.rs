use anyhow::{Context, Result};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Default)]
pub struct CodexCliConfig {
    pub model_provider: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
}

pub fn codex_home_dir() -> Result<PathBuf> {
    let home = std::env::var_os("HOME").context("$HOME is not set")?;
    Ok(PathBuf::from(home).join(".codex"))
}

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

    Ok(CodexCliConfig {
        model_provider,
        base_url,
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

pub fn redact_api_key(api_key: &str) -> String {
    // Keep a tiny prefix/suffix to help debugging without leaking secrets.
    let trimmed = api_key.trim();
    if trimmed.len() <= 8 {
        return "***".to_string();
    }
    let prefix = &trimmed[..4];
    let suffix = &trimmed[trimmed.len() - 4..];
    format!("{prefix}***{suffix}")
}
