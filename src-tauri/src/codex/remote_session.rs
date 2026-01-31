//! Remote session utilities for parsing and handling remote paths.

use anyhow::{anyhow, Result};
use std::path::PathBuf;

const REMOTE_PREFIX: &str = "remote://";

/// Parse a path that may be a remote path in format: remote://<server-id><remote-path>
/// Returns (is_remote, server_id, path)
pub fn parse_remote_path(path_str: &str) -> Result<(bool, Option<String>, PathBuf)> {
    if !path_str.starts_with(REMOTE_PREFIX) {
        // Local path
        return Ok((false, None, PathBuf::from(path_str)));
    }

    // Remote path: remote://<server-id><absolute-path>
    let remainder = &path_str[REMOTE_PREFIX.len()..];

    // Find where the path starts (first '/')
    if let Some(path_start) = remainder.find('/') {
        let server_id = remainder[..path_start].to_string();
        let remote_path = PathBuf::from(&remainder[path_start..]);

        if server_id.is_empty() {
            return Err(anyhow!("Remote path missing server ID"));
        }

        Ok((true, Some(server_id), remote_path))
    } else {
        Err(anyhow!(
            "Invalid remote path format, expected: remote://<server-id><path>"
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_local_path() {
        let (is_remote, server_id, path) = parse_remote_path("/home/user/project").unwrap();
        assert!(!is_remote);
        assert!(server_id.is_none());
        assert_eq!(path, PathBuf::from("/home/user/project"));
    }

    #[test]
    fn test_parse_remote_path() {
        let (is_remote, server_id, path) =
            parse_remote_path("remote://server1/home/user/project").unwrap();
        assert!(is_remote);
        assert_eq!(server_id, Some("server1".to_string()));
        assert_eq!(path, PathBuf::from("/home/user/project"));
    }

    #[test]
    fn test_parse_invalid_remote_path() {
        assert!(parse_remote_path("remote://server-no-path").is_err());
        assert!(parse_remote_path("remote:///no-server").is_err());
    }
}
